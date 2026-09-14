import { authorize, type Actor, type AuthorizationDecision } from '../permissions/authorize.js';
import { runCommand } from '../execution/command-runner.js';
import type { ProjectConfig } from '../../config/project.generated.js';
import type { CommandExecutionResult, CommandRunnerOptions } from '../execution/types.js';
import type { GateOutcome, GatePlan } from './plan.js';

/** The capability an actor must hold to run a declared quality command. */
export const EXECUTION_CAPABILITY = 'run_tests';

/**
 * Who is asking for the commands to run.
 *
 * A person running the CLI in their own checkout is not an agent, and pretending
 * otherwise would make the capability model describe something that never happened.
 * An agent acts under a role, and that role's declared capabilities decide the
 * answer. Anything unrecognised is denied.
 */
export type QualityActor = Actor;

/**
 * Whether this actor may run this project's declared commands.
 *
 * Exported so a caller can ask before doing anything — the CLI says so up front
 * rather than printing a plan it is not allowed to carry out. Asking is not what
 * makes the decision binding: `executeQualityPlan` calls this itself, so there is no
 * arrangement of arguments that reaches a process without the answer being consulted.
 */
export function authorizeExecution(actor: Actor, project: ProjectConfig): AuthorizationDecision {
  return authorize({ actor, capability: EXECUTION_CAPABILITY, project });
}

export type QualityGateOutcome = GateOutcome | 'timed-out' | 'execution-error';
export type QualityFinalStatus = 'pass' | 'fail' | 'incomplete';
export type QualityGateReason =
  | 'manual'
  | 'no-command'
  | 'not-executed'
  | 'prior-gate-failed'
  | 'unsupported-command'
  | 'executable-not-found'
  | 'shell-required'
  | 'capability-denied'
  | 'approval-required';

export interface QualityGateResult {
  stage: string;
  title: string;
  outcome: QualityGateOutcome;
  command: string | null;
  reason: QualityGateReason | null;
  execution?: CommandExecutionResult;
}

export interface QualityExecutionResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  executed: boolean;
  /** True when the actor may not run commands at all. */
  denied: boolean;
  /** The decision that permitted or refused the run, kept so a result explains itself. */
  authorization: AuthorizationDecision;
  gates: QualityGateResult[];
  finalStatus: QualityFinalStatus;
}

export type QualityCommandRunner = (
  command: string,
  options: CommandRunnerOptions,
) => Promise<CommandExecutionResult>;

export interface ExecuteQualityPlanOptions {
  root: string;
  timeoutSeconds: number;
  execute: boolean;
  /** Whose capabilities authorise the run. */
  actor: QualityActor;
  /**
   * The declaration the actor is authorised against. Required, because the project
   * decides which tools exist at all, and a decision made without it would be a
   * decision about a role in the abstract rather than about this repository.
   */
  project: ProjectConfig;
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: QualityCommandRunner;
}

function finalStatus(gates: readonly QualityGateResult[]): QualityFinalStatus {
  if (gates.some(gate => ['failed', 'timed-out', 'execution-error'].includes(gate.outcome))) {
    return 'fail';
  }
  if (gates.length === 0 || gates.some(gate => gate.outcome !== 'passed')) return 'incomplete';
  return 'pass';
}

function unexecuted(entry: GatePlan, reason: QualityGateReason, outcome: QualityGateOutcome): QualityGateResult {
  return {
    stage: entry.stage.id,
    title: entry.stage.title,
    outcome,
    command: entry.command ?? null,
    reason,
  };
}

/**
 * Executes an existing quality plan in order. Planning remains a separate, pure step.
 *
 * This is the only place in the harness that starts a process, and it is deliberately
 * narrow. It runs only commands that came out of resolution, so no caller can pass one
 * in; it does nothing unless `execute` is true; and it checks the actor's authority
 * first, which is the one point where the declared policy is actually enforced rather
 * than merely described.
 */
export async function executeQualityPlan(
  plan: readonly GatePlan[],
  options: ExecuteQualityPlanOptions,
): Promise<QualityExecutionResult> {
  const started = Date.now();
  const runner = options.runner ?? runCommand;

  /*
   * The authorization boundary. An agent and a person share this engine, but their
   * authority comes from the same decision function rather than from whichever
   * caller reached it. The decision is taken here, not accepted as an argument, so
   * no caller can hand in an approval it did not obtain.
   */
  const authorization = authorizeExecution(options.actor, options.project);
  const permitted = authorization.outcome === 'allowed';
  const refusal: QualityGateReason =
    authorization.outcome === 'requires-approval' ? 'approval-required' : 'capability-denied';

  const gates: QualityGateResult[] = [];
  let stopped = false;
  let commandStarted = false;

  for (const entry of plan) {
    if (entry.readiness === 'not-applicable') continue;
    if (entry.readiness === 'manual') {
      gates.push(unexecuted(entry, 'manual', 'unrun'));
      continue;
    }
    if (entry.readiness === 'unavailable' || entry.command === undefined) {
      gates.push(unexecuted(entry, 'no-command', 'unavailable'));
      continue;
    }
    if (!permitted) {
      gates.push(unexecuted(entry, refusal, 'unrun'));
      continue;
    }
    if (!options.execute) {
      gates.push(unexecuted(entry, 'not-executed', 'unrun'));
      continue;
    }
    if (stopped) {
      gates.push(unexecuted(entry, 'prior-gate-failed', 'unrun'));
      continue;
    }

    commandStarted = true;
    const execution = await runner(entry.command, {
      cwd: options.root,
      timeoutSeconds: options.timeoutSeconds,
      ...(options.maxOutputBytes === undefined ? {} : { maxOutputBytes: options.maxOutputBytes }),
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.platform === undefined ? {} : { platform: options.platform }),
    });

    let outcome: QualityGateOutcome;
    let reason: QualityGateReason | null = null;
    if (execution.status === 'unsupported') {
      // A command written for a shell is one this harness cannot run, not one that failed.
      outcome = 'unavailable';
      reason = 'unsupported-command';
    } else if (execution.status === 'execution-error' && execution.errorCode === 'ENOENT') {
      // The tool is absent from this machine. That says nothing about the code.
      outcome = 'unavailable';
      reason = 'executable-not-found';
    } else if (execution.status === 'execution-error' && execution.errorCode === 'EINVAL') {
      /*
       * Windows refuses to start a `.cmd` or `.bat` outside a shell. The gate is
       * one this harness will not run here, which is unavailable. Calling it a
       * failure would blame the project for a platform constraint.
       */
      outcome = 'unavailable';
      reason = 'shell-required';
    } else {
      outcome = execution.status;
    }
    gates.push({
      stage: entry.stage.id,
      title: entry.stage.title,
      outcome,
      command: entry.command,
      reason,
      execution,
    });
    if (outcome === 'failed' || outcome === 'timed-out' || outcome === 'execution-error') stopped = true;
  }

  const finished = Date.now();
  return {
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    executed: commandStarted,
    denied: !permitted,
    authorization,
    gates,
    finalStatus: finalStatus(gates),
  };
}

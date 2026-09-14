import { runCommand } from '../execution/command-runner.js';
import type { CommandExecutionResult, CommandRunnerOptions } from '../execution/types.js';
import type { GateOutcome, GatePlan } from './plan.js';

export type QualityGateOutcome = GateOutcome | 'timed-out' | 'execution-error';
export type QualityFinalStatus = 'pass' | 'fail' | 'incomplete';
export type QualityGateReason =
  | 'manual'
  | 'no-command'
  | 'not-executed'
  | 'prior-gate-failed'
  | 'unsupported-command';

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
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
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

/** Executes an existing quality plan in order. Planning remains a separate, pure step. */
export async function executeQualityPlan(
  plan: readonly GatePlan[],
  options: ExecuteQualityPlanOptions,
): Promise<QualityExecutionResult> {
  const started = Date.now();
  const runner = options.runner ?? runCommand;
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
    });

    let outcome: QualityGateOutcome;
    let reason: QualityGateReason | null = null;
    if (execution.status === 'unsupported') {
      outcome = 'unavailable';
      reason = 'unsupported-command';
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
    gates,
    finalStatus: finalStatus(gates),
  };
}

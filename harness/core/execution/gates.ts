import type { ResolvedProject } from '../profiles/resolve.js';
import { can } from '../permissions/decide.js';
import { planQuality, type GateOutcome, type GatePlan } from '../quality/plan.js';
import { resolveExecutable, toArgv } from './executable.js';
import { runCommand } from './command-runner.js';

/**
 * Running the gates a project declared.
 *
 * This is the first part of the harness that does anything to a machine, so it is
 * deliberately narrow:
 *
 * - It runs only commands that came out of resolution. It never accepts a command
 *   as an argument, so there is no path from a caller to an arbitrary process.
 * - It does nothing at all unless `execute` is true. Planning stays free of effects.
 * - It checks the acting role's capability first. A role without `run_tests` runs
 *   nothing, which is the first point in this project where the policy is enforced
 *   rather than merely described.
 * - It bounds every run by the project's declared duration limit and caps the output
 *   it retains.
 *
 * Nothing here is imported by validation or resolution, so loading a configuration
 * still cannot execute anything.
 */

/** The capability a role must hold to run a declared quality command. */
export const EXECUTION_CAPABILITY = 'run_tests';

export type GateRefusal =
  | 'manual'
  | 'no-command'
  | 'shell-syntax'
  | 'executable-not-found'
  | 'capability-denied'
  | 'not-executed';

export interface GateExecution {
  stage: string;
  outcome: GateOutcome;
  command: string | null;
  /** Why the gate did not run, when it did not. Null when it ran. */
  refusal: GateRefusal | null;
  exitCode: number | null;
  durationMs: number | null;
  timedOut: boolean;
  /** Combined output, truncated to a fixed ceiling. */
  output: string;
}

export interface ExecuteOptions {
  /** Directory the commands run in. */
  root: string;
  /** Role whose capabilities authorise the run. */
  agent: string;
  /** Nothing is executed unless this is true. */
  execute: boolean;
  /** Per-gate ceiling in seconds. Defaults to the project's declared limit. */
  timeoutSeconds?: number;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

export interface ExecutionReport {
  agent: string;
  executed: boolean;
  /** Set when the acting role may not run commands at all. */
  denied: boolean;
  gates: GateExecution[];
  durationMs: number;
}

function skipped(stage: string, refusal: GateRefusal, outcome: GateOutcome, command: string | null): GateExecution {
  return { stage, outcome, command, refusal, exitCode: null, durationMs: null, timedOut: false, output: '' };
}

/**
 * Executes, or merely reports, the gates a resolved project declares.
 *
 * With `execute: false` nothing is spawned and every applicable gate is reported
 * `unrun`, which is what the model already says about a gate nobody ran.
 */
export async function executeGates(
  resolved: ResolvedProject,
  options: ExecuteOptions,
): Promise<ExecutionReport> {
  const started = Date.now();
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const timeoutSeconds = options.timeoutSeconds ?? resolved.config.limits.max_duration_seconds;
  const permitted = can(options.agent, EXECUTION_CAPABILITY);

  const plan: GatePlan[] = planQuality(resolved);
  const gates: GateExecution[] = [];

  for (const entry of plan) {
    const stage = entry.stage.id;
    if (entry.readiness === 'not-applicable') continue;
    if (entry.readiness === 'manual') {
      gates.push(skipped(stage, 'manual', 'unrun', null));
      continue;
    }
    if (entry.readiness === 'unavailable' || entry.command === undefined) {
      gates.push(skipped(stage, 'no-command', 'unavailable', null));
      continue;
    }

    const command = entry.command;
    if (!permitted) {
      gates.push(skipped(stage, 'capability-denied', 'unrun', command));
      continue;
    }
    if (!options.execute) {
      gates.push(skipped(stage, 'not-executed', 'unrun', command));
      continue;
    }

    const argv = toArgv(command);
    if (!argv.ok) {
      gates.push(skipped(stage, 'shell-syntax', 'unavailable', command));
      continue;
    }

    const [name] = argv.argv;
    const file = await resolveExecutable(name, { cwd: options.root, env, platform });
    if (file === null) {
      gates.push(skipped(stage, 'executable-not-found', 'unavailable', command));
      continue;
    }

    const result = await runCommand(command, {
      cwd: options.root,
      env,
      timeoutSeconds,
    });
    gates.push({
      stage,
      outcome: result.status === 'passed' ? 'passed' : 'failed',
      command,
      refusal: null,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      output: `${result.stdout}${result.stderr}`,
    });
  }

  return {
    agent: options.agent,
    executed: options.execute && permitted,
    denied: !permitted,
    gates,
    durationMs: Date.now() - started,
  };
}

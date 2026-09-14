export type CommandExecutionStatus =
  | 'passed'
  | 'failed'
  | 'timed-out'
  | 'unsupported'
  | 'execution-error';

export type UnsupportedCommandReason = 'empty' | 'shell-syntax';

/**
 * How the process was started. `direct` is the normal case. `cmd.exe` records that a
 * Windows batch launcher was reached through an argument vector this harness built,
 * which is recorded rather than left implicit because it is the one place a command
 * interpreter is involved at all.
 */
export type CommandLauncher = 'direct' | 'cmd.exe';

export interface ParsedCommand {
  program: string;
  args: string[];
}

export interface CommandExecutionResult {
  command: string;
  program: string | null;
  args: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  status: CommandExecutionStatus;
  timedOut: boolean;
  outputTruncated: boolean;
  launcher: CommandLauncher;
  unsupportedReason?: UnsupportedCommandReason;
  /** Stable error category only. OS error messages can contain private paths. */
  errorCode?: string;
}

export interface CommandRunnerOptions {
  cwd: string;
  timeoutSeconds: number;
  /** Maximum retained bytes across stdout and stderr. */
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
  /** Overridden only by tests that exercise the other platform's lookup rules. */
  platform?: NodeJS.Platform;
}

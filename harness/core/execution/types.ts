export type CommandExecutionStatus =
  | 'passed'
  | 'failed'
  | 'timed-out'
  | 'unsupported'
  | 'execution-error';

export type UnsupportedCommandReason = 'empty' | 'shell-syntax';

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
}

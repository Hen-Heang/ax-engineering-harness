import { spawn } from 'node:child_process';
import { parseCommand } from './command-parser.js';
import { resolveExecutable } from './executable.js';
import type { CommandExecutionResult, CommandRunnerOptions } from './types.js';

export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

function timestamp(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

/**
 * Starting a Windows batch launcher without becoming a shell.
 *
 * `npm`, `gradlew` and `mvnw` are all `.cmd` or `.bat` files on Windows, and since
 * Node 18.20 `spawn` refuses to start one directly (CVE-2024-27980): a batch file
 * can only run under cmd.exe, and cmd.exe's quoting rules make a naively built
 * command line an injection surface.
 *
 * `shell: true` is still refused, because it would hand cmd.exe the declared command
 * *string* and let it re-parse the whole thing. Instead the argument vector is
 * already fixed by the parser before this point, and it is guaranteed to contain no
 * whitespace, quotes, operators, substitutions, or cmd.exe's `%` and `^`. Only the
 * resolved file path — which the parser never saw and which may legitimately contain
 * spaces — needs quoting.
 *
 * The doubled outer quotes are required: with `/s`, cmd.exe strips the first and
 * last character when both are quotes and takes the rest verbatim. Without the outer
 * pair, a command with no arguments would have its path quotes stripped instead and
 * would break on the first space.
 */
export function buildBatchCommandLine(file: string, args: readonly string[]): string {
  return `""${file}"${args.map(argument => ` ${argument}`).join('')}"`;
}

const WINDOWS_BATCH = /\.(cmd|bat)$/i;

/** Path characters cmd.exe would still interpret, however the arguments are built. */
const UNSAFE_IN_PATH = /["%^]/;

function appendBounded(
  current: Buffer<ArrayBufferLike>,
  chunk: Buffer<ArrayBufferLike>,
  remaining: number,
): { value: Buffer<ArrayBufferLike>; retained: number; truncated: boolean } {
  if (chunk.length <= remaining) {
    return { value: Buffer.concat([current, chunk]), retained: chunk.length, truncated: false };
  }
  return {
    value: remaining > 0 ? Buffer.concat([current, chunk.subarray(0, remaining)]) : current,
    retained: Math.max(remaining, 0),
    truncated: true,
  };
}

/** Runs one already-resolved command without invoking a shell. */
export async function runCommand(
  command: string,
  options: CommandRunnerOptions,
): Promise<CommandExecutionResult> {
  const started = Date.now();
  const outputLimit = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(outputLimit) || outputLimit < 0) {
    throw new RangeError('maxOutputBytes must be a non-negative safe integer.');
  }
  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new RangeError('timeoutSeconds must be greater than zero.');
  }

  const blank = (program: string | null, args: string[]) => ({
    command, program, args, startedAt: timestamp(started), finishedAt: timestamp(Date.now()),
    durationMs: Date.now() - started, exitCode: null, stdout: '', stderr: '',
    timedOut: false, outputTruncated: false, launcher: 'direct' as CommandExecutionResult['launcher'],
  });

  const parsed = parseCommand(command);
  if (!parsed.supported) {
    return { ...blank(null, []), status: 'unsupported', unsupportedReason: parsed.reason };
  }

  const { program, args } = parsed.command;
  const env = options.env ?? process.env;

  /*
   * The executable is looked up here rather than by a shell. On Windows `npm` is
   * really `npm.cmd`, and `shell: true` would resolve that only by reintroducing
   * shell parsing of the whole command line. A name that resolves to nothing is an
   * infrastructure error, not a failing command.
   */
  const file = await resolveExecutable(program, {
    cwd: options.cwd,
    env,
    ...(options.platform === undefined ? {} : { platform: options.platform }),
  });
  if (file === null) {
    return { ...blank(program, args), status: 'execution-error', errorCode: 'ENOENT' };
  }

  const platform = options.platform ?? process.platform;
  const batch = platform === 'win32' && WINDOWS_BATCH.test(file);
  if (batch && UNSAFE_IN_PATH.test(file)) {
    // Refuse rather than reason about how cmd.exe would read this path.
    return { ...blank(program, args), status: 'execution-error', errorCode: 'EUNSAFEPATH', launcher: 'cmd.exe' };
  }
  const launcher: CommandExecutionResult['launcher'] = batch ? 'cmd.exe' : 'direct';
  const spawnFile = batch ? (env.COMSPEC ?? 'cmd.exe') : file;
  const spawnArgs = batch ? ['/d', '/s', '/c', buildBatchCommandLine(file, args)] : args;

  return new Promise(resolve => {
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let retainedBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;

    let child;
    try {
      child = spawn(spawnFile, spawnArgs, {
        cwd: options.cwd,
        env,
        // Never true. A batch file is reached through an argv this module built,
        // not by handing cmd.exe the declared command string to re-parse.
        shell: false,
        windowsHide: true,
        // The batch command line is quoted above; Node must not re-quote it.
        ...(batch ? { windowsVerbatimArguments: true } : {}),
      });
    } catch (error) {
      /*
       * `spawn` can throw synchronously rather than emitting `error`. Since Node
       * 18.20 it does exactly that, with EINVAL, for a Windows `.cmd` or `.bat`
       * file, because those can only be run through `cmd.exe` and their argument
       * quoting is unsafe (CVE-2024-27980). Refusing is correct; crashing the
       * caller is not, so the refusal is reported like any other one.
       */
      const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'spawn-error';
      resolve({ ...blank(program, args), launcher, status: 'execution-error', errorCode: code });
      return;
    }

    const collect = (stream: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const appended = appendBounded(
        stream === 'stdout' ? stdout : stderr,
        bytes,
        Math.max(outputLimit - retainedBytes, 0),
      );
      if (stream === 'stdout') stdout = appended.value;
      else stderr = appended.value;
      retainedBytes += appended.retained;
      outputTruncated ||= appended.truncated;
    };
    child.stdout?.on('data', chunk => collect('stdout', chunk));
    child.stderr?.on('data', chunk => collect('stderr', chunk));

    const finish = (status: CommandExecutionResult['status'], exitCode: number | null, errorCode?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const finished = Date.now();
      resolve({
        command,
        /* The declared name, never the resolved absolute path, which can contain a
         * home directory and therefore a username. Run records are publishable. */
        program, args, startedAt: timestamp(started), finishedAt: timestamp(finished),
        durationMs: finished - started, exitCode, stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'), status, timedOut, outputTruncated, launcher,
        ...(errorCode === undefined ? {} : { errorCode }),
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutSeconds * 1000);

    child.once('error', error => {
      const code = 'code' in error && typeof error.code === 'string' ? error.code : 'spawn-error';
      finish('execution-error', null, code);
    });
    child.once('close', code => {
      if (timedOut) finish('timed-out', code);
      else finish(code === 0 ? 'passed' : 'failed', code);
    });
  });
}

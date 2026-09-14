import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { parseCommand } from './command-parser.js';

/**
 * Turning a declared command into something safe to execute.
 *
 * A declared command is an opaque string. Handing it to a shell would make every
 * project declaration a remote-code-execution surface, so this module never does:
 * it splits the command into an argument vector and resolves the executable against
 * PATH itself. A command that cannot be expressed that way is refused rather than
 * executed a different way.
 */

/**
 * Characters that only mean something to a shell. Their presence means the command
 * was written expecting one, so it cannot be honoured without becoming one.
 */
export type ArgvRefusal = 'shell_syntax' | 'empty';

export type ArgvResult =
  | { ok: true; argv: [string, ...string[]] }
  | { ok: false; refusal: ArgvRefusal };

/** Splits a declared command into an argument vector, or refuses. */
export function toArgv(command: string): ArgvResult {
  const parsed = parseCommand(command);
  if (!parsed.supported) {
    return { ok: false, refusal: parsed.reason === 'shell-syntax' ? 'shell_syntax' : 'empty' };
  }
  return { ok: true, argv: [parsed.command.program, ...parsed.command.args] };
}

async function isExecutableFile(candidate: string): Promise<boolean> {
  try {
    if (!(await stat(candidate)).isFile()) return false;
    if (process.platform !== 'win32') await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Extensions Windows treats as executable, so `npm` can find `npm.cmd`. */
function windowsExtensions(env: NodeJS.ProcessEnv): string[] {
  const pathext = env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
  return pathext.split(';').map(part => part.trim()).filter(part => part.length > 0);
}

/**
 * The suffixes to try for a name on this platform, in order.
 *
 * Windows must not try the bare name first. Node and Gradle both ship an
 * extensionless POSIX shell script beside the Windows launcher, so `npm` finds a
 * file that exists, is a regular file, and cannot be executed by `CreateProcess` —
 * which surfaces much later as a misleading ENOENT. Following the rule cmd.exe
 * itself uses, a name that already carries a known extension is taken as written,
 * and any other name gets PATHEXT appended.
 */
function candidateExtensions(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, name: string): string[] {
  if (platform !== 'win32') return [''];
  const extensions = windowsExtensions(env);
  const already = extensions.some(extension => name.toLowerCase().endsWith(extension.toLowerCase()));
  return already ? [''] : extensions;
}

export interface ResolveExecutableOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

/**
 * Finds the real file a command name refers to.
 *
 * Doing this here rather than passing `shell: true` is the whole point: on Windows
 * `npm` is `npm.cmd`, and delegating that lookup to a shell would reintroduce shell
 * parsing of the rest of the command line. Returns null when nothing is found, which
 * the caller reports as an unavailable gate rather than a failure.
 */
export async function resolveExecutable(
  name: string,
  options: ResolveExecutableOptions,
): Promise<string | null> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const extensions = candidateExtensions(platform, env, name);

  const explicit = name.includes('/') || name.includes('\\');
  const path = (env.PATH ?? env.Path ?? '').split(delimiter).filter(part => part.length > 0);

  /*
   * Windows searches the current directory before PATH, and POSIX deliberately does
   * not — leaving `.` out of PATH is how a POSIX system avoids running whatever a
   * directory happens to contain. Both behaviours are honoured as written, because
   * the Windows wrapper form a profile declares is a bare `mvnw.cmd` or
   * `gradlew.bat` that only resolves under the first rule, while the POSIX form is
   * an explicit `./mvnw` that needs no such allowance.
   */
  const roots = explicit
    ? [isAbsolute(name) ? '' : options.cwd]
    : (platform === 'win32' ? [options.cwd, ...path] : path);

  for (const root of roots) {
    const base = explicit
      ? (isAbsolute(name) ? name : resolve(options.cwd, name))
      : join(root, name);
    for (const extension of extensions) {
      const candidate = `${base}${extension}`;
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

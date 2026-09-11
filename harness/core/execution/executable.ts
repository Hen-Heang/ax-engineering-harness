import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

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
const SHELL_SYNTAX = /[|&;<>()$`\\"'*?[\]{}!#~\n\r\t]/;

export type ArgvRefusal = 'shell_syntax' | 'empty';

export type ArgvResult =
  | { ok: true; argv: [string, ...string[]] }
  | { ok: false; refusal: ArgvRefusal };

/** Splits a declared command into an argument vector, or refuses. */
export function toArgv(command: string): ArgvResult {
  if (SHELL_SYNTAX.test(command)) return { ok: false, refusal: 'shell_syntax' };
  const argv = command.split(' ').filter(part => part.length > 0);
  const [file, ...args] = argv;
  if (file === undefined) return { ok: false, refusal: 'empty' };
  return { ok: true, argv: [file, ...args] };
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
  const extensions = platform === 'win32' ? ['', ...windowsExtensions(env)] : [''];

  const explicit = name.includes('/') || name.includes('\\');
  const roots = explicit
    ? [isAbsolute(name) ? '' : options.cwd]
    : (env.PATH ?? env.Path ?? '').split(delimiter).filter(part => part.length > 0);

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

import type { ParsedCommand, UnsupportedCommandReason } from './types.js';

export type CommandParseResult =
  | { supported: true; command: ParsedCommand }
  | { supported: false; reason: UnsupportedCommandReason };

/*
 * v1 deliberately supports whitespace-separated tokens only. Quotes and escapes
 * would require shell-like parsing rules, so they are refused along with operators,
 * substitutions, redirects, globbing, and control characters.
 */
const UNSUPPORTED_SYNTAX = /[|&;<>()$`\\"'*?\[\]{}!#~\n\r\t]/;

export function parseCommand(command: string): CommandParseResult {
  if (UNSUPPORTED_SYNTAX.test(command)) return { supported: false, reason: 'shell-syntax' };
  const tokens = command.trim().split(/ +/).filter(Boolean);
  const [program, ...args] = tokens;
  if (program === undefined) return { supported: false, reason: 'empty' };
  return { supported: true, command: { program, args } };
}

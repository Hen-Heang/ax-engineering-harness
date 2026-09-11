import { open } from 'node:fs/promises';
import { isAlias, parseDocument, visit } from 'yaml';
import { validateDeclaration, type ValidationResult } from './validate.js';

export const MAX_CONFIG_BYTES = 64 * 1024;

function failure(code: string, message: string): ValidationResult {
  return { valid: false, issues: [{ path: '/', code, message }] };
}

export function parseProject(source: string): ValidationResult {
  if (Buffer.byteLength(source, 'utf8') > MAX_CONFIG_BYTES) {
    return failure('yaml.too_large', 'Configuration exceeds the 64 KiB limit.');
  }
  try {
    const document = parseDocument(source, { uniqueKeys: true, prettyErrors: false });
    if (document.errors.length || document.warnings.length) {
      return failure('yaml.invalid', 'Invalid YAML: check syntax, duplicate keys, tags, and document count.');
    }
    let alias = false;
    visit(document, { Node(_key, node) { if (isAlias(node)) alias = true; } });
    if (alias) return failure('yaml.alias', 'YAML aliases are not supported in project configuration.');
    return validateDeclaration(document.toJS({ maxAliasCount: 0 }));
  } catch {
    return failure('yaml.invalid', 'Configuration could not be parsed safely.');
  }
}

/** Read only the explicitly selected configuration, with bounded allocation. */
export async function loadProject(file: string): Promise<ValidationResult> {
  let handle;
  try {
    handle = await open(file, 'r');
    const stat = await handle.stat();
    if (!stat.isFile()) return failure('file.invalid', 'Configuration must be a regular file.');
    if (stat.size > MAX_CONFIG_BYTES) return failure('yaml.too_large', 'Configuration exceeds the 64 KiB limit.');
    const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > MAX_CONFIG_BYTES) return failure('yaml.too_large', 'Configuration exceeds the 64 KiB limit.');
    return parseProject(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, total)));
  } catch {
    return failure('file.unreadable', 'Configuration could not be read as a UTF-8 file.');
  } finally {
    await handle?.close();
  }
}

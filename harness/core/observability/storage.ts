import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigIssue } from '../../config/validate.js';
import { validateRunRecord, type RunValidation } from './run.js';

export const MAX_RUN_RECORD_BYTES = 1024 * 1024;

export type PersistRunResult =
  | { saved: true; file: string }
  | { saved: false; code: 'invalid-record' | 'not-recorded' | 'already-exists' | 'write-error'; issues?: ConfigIssue[] };

export type LoadRunResult = RunValidation;

export async function persistRunRecord(root: string, input: unknown): Promise<PersistRunResult> {
  const validation = validateRunRecord(input);
  if (!validation.valid) return { saved: false, code: 'invalid-record', issues: validation.issues };
  if (validation.record.kind !== 'recorded') return { saved: false, code: 'not-recorded' };

  const directory = join(root, '.ax', 'runs');
  const file = join(directory, `${validation.record.id}.json`);
  try {
    await mkdir(directory, { recursive: true });
    const handle = await open(file, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(validation.record, null, 2)}\n`, 'utf8');
    } finally {
      await handle.close();
    }
    return { saved: true, file };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      return { saved: false, code: 'already-exists' };
    }
    return { saved: false, code: 'write-error' };
  }
}

export async function loadRunRecord(file: string): Promise<LoadRunResult> {
  let handle;
  try {
    handle = await open(file, 'r');
    const stat = await handle.stat();
    if (!stat.isFile()) {
      return { valid: false, issues: [{ path: '/', code: 'run.unreadable', message: 'Run record must be a regular file.' }] };
    }
    if (stat.size > MAX_RUN_RECORD_BYTES) {
      return { valid: false, issues: [{ path: '/', code: 'run.too_large', message: 'Run record exceeds 1 MiB.' }] };
    }
    const source = Buffer.alloc(MAX_RUN_RECORD_BYTES + 1);
    let total = 0;
    while (total < source.length) {
      const { bytesRead } = await handle.read(source, total, source.length - total, null);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_RUN_RECORD_BYTES) {
      return { valid: false, issues: [{ path: '/', code: 'run.too_large', message: 'Run record exceeds 1 MiB.' }] };
    }
    return validateRunRecord(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source.subarray(0, total))));
  } catch (error) {
    const code = error instanceof SyntaxError ? 'run.malformed' : 'run.unreadable';
    return { valid: false, issues: [{ path: '/', code, message: 'Run record could not be loaded.' }] };
  } finally {
    await handle?.close();
  }
}

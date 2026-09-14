import { mkdir, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { InitPlan } from './plan.js';

/**
 * Writing an adoption that was already planned.
 *
 * Every file is opened with the `wx` flag, so refusing to overwrite is a property of
 * the system call rather than of a check this module performs. A file that appears
 * between planning and writing is therefore still safe: the write fails and is
 * reported, instead of quietly replacing work somebody had just done.
 */

export type WriteOutcome = 'written' | 'skipped-exists' | 'failed';

export interface WriteResult {
  path: string;
  outcome: WriteOutcome;
  /** Stable error category. OS messages can contain private paths. */
  code?: string;
}

export interface ApplyResult {
  written: WriteResult[];
  /** True when every file the plan proposed was created. */
  complete: boolean;
}

/**
 * Applies a plan. Only files the plan marked `create` are attempted, and a plan with
 * blockers writes nothing at all.
 */
export async function applyInit(plan: InitPlan): Promise<ApplyResult> {
  if (plan.blockers.length > 0) return { written: [], complete: false };

  const results: WriteResult[] = [];
  for (const file of plan.files) {
    if (file.status !== 'create') {
      results.push({ path: file.path, outcome: 'skipped-exists' });
      continue;
    }
    const target = join(plan.root, file.path);
    try {
      await mkdir(dirname(target), { recursive: true });
      const handle = await open(target, 'wx');
      try {
        await handle.writeFile(file.contents, 'utf8');
      } finally {
        await handle.close();
      }
      results.push({ path: file.path, outcome: 'written' });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'write-error';
      results.push({
        path: file.path,
        outcome: code === 'EEXIST' ? 'skipped-exists' : 'failed',
        ...(code === 'EEXIST' ? {} : { code }),
      });
    }
  }

  const attempted = plan.files.filter(file => file.status === 'create').length;
  const written = results.filter(result => result.outcome === 'written').length;
  return { written: results, complete: attempted > 0 && written === attempted };
}

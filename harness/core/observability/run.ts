import { Ajv } from 'ajv';
import schema from '../../schemas/run.schema.json' with { type: 'json' };
import exampleCancellation from '../../runs/example-cancellation/run.json' with { type: 'json' };
import type { RunRecord } from '../../config/run.generated.js';
import type { ConfigIssue } from '../../config/validate.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<RunRecord>(schema);

function register(id: string, source: unknown): RunRecord {
  if (!validateSchema(source)) throw new Error(`Built-in run record "${id}" does not satisfy the run schema.`);
  if (source.id !== id) throw new Error(`Built-in run record "${id}" declares a different identifier.`);
  if (source.kind !== 'example') {
    throw new Error(`Run record "${id}" claims to be recorded, but nothing in this repository can execute a run.`);
  }
  return source;
}

/**
 * Run records shipped with the harness. Every one is an example.
 *
 * A record may only be `recorded` if a real execution produced it. No component
 * here can execute anything, so a recorded run shipped in this repository would be
 * fabricated, and the registry refuses to load one.
 */
const records = new Map<string, RunRecord>([
  ['example-cancellation', register('example-cancellation', exampleCancellation)],
]);

export const runIds: readonly string[] = [...records.keys()];

export function getRun(id: string): RunRecord | undefined {
  return records.get(id);
}

export type RunValidation =
  | { valid: true; record: RunRecord }
  | { valid: false; issues: ConfigIssue[] };

/**
 * Validates an external run record without trusting or storing it.
 *
 * A record claiming to be `recorded` is rejected, because no component in this build
 * can execute a run, so such a record could only have been fabricated. Remove this
 * check deliberately when a real execution engine exists, not before.
 */
export function validateRunRecord(input: unknown): RunValidation {
  if (validateSchema(input)) {
    if (input.kind === 'recorded') {
      return {
        valid: false,
        issues: [{
          path: '/kind',
          code: 'run.not_executable',
          message: 'A recorded run requires a real execution, which this build cannot produce.',
        }],
      };
    }
    return { valid: true, record: input };
  }
  return {
    valid: false,
    issues: (validateSchema.errors ?? []).map(error => ({
      path: error.instancePath || '/',
      code: `schema.${error.keyword}`,
      message: error.message ?? 'Invalid run record field.',
    })),
  };
}

/**
 * A measurement that was never taken is absent, never zero. Callers must ask this
 * rather than reading a default, so an unmeasured cost is never displayed as free.
 */
export function isMeasured(record: RunRecord, field: 'inputTokens' | 'outputTokens' | 'costUsd'): boolean {
  return record.measurements?.[field] !== undefined;
}

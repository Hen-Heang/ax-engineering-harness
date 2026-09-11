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
 * This used to reject `kind: "recorded"` outright, because nothing in the build could
 * execute a run and such a record could therefore only have been fabricated. The gate
 * runner in `core/execution` can now produce one, so that refusal has been lifted
 * deliberately, which is the condition the earlier check was written to wait for.
 *
 * What still holds is narrower and enforced elsewhere: a record shipped *with* the
 * harness must be an example, because a real run belongs to whoever ran it rather
 * than to this repository. The built-in registry keeps that check.
 */
export function validateRunRecord(input: unknown): RunValidation {
  if (validateSchema(input)) {
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

export interface RunRecordInputs {
  id: string;
  task: string;
  agent: string;
  profile: string;
  tools: RunRecord['tools'];
  gates: RunRecord['gates'];
  notes: [string, ...string[]];
  durationSeconds?: number;
  retries?: number;
}

/**
 * Builds a recorded run and validates it before returning.
 *
 * Construction goes through validation so a caller cannot produce a record that the
 * schema would reject. Fields this harness does not measure are left out rather than
 * defaulted: it does not track which files a command read or changed, and it measures
 * no tokens or cost, so those stay absent and continue to mean unmeasured.
 */
export function buildRunRecord(inputs: RunRecordInputs): RunValidation {
  const passed = inputs.gates.every(gate => gate.outcome === 'passed');
  const record = {
    schemaVersion: 1 as const,
    id: inputs.id,
    kind: 'recorded' as const,
    task: inputs.task,
    agent: inputs.agent,
    profile: inputs.profile,
    status: (inputs.gates.length > 0 && passed ? 'completed' : 'failed') as RunRecord['status'],
    retries: inputs.retries ?? 0,
    tools: inputs.tools,
    filesRead: [],
    filesChanged: [],
    gates: inputs.gates,
    notes: inputs.notes,
    ...(inputs.durationSeconds === undefined ? {} : { durationSeconds: inputs.durationSeconds }),
  };
  return validateRunRecord(record);
}

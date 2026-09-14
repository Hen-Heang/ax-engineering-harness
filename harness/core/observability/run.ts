import { randomUUID } from 'node:crypto';
import { Ajv } from 'ajv';
import schema from '../../schemas/run.schema.json' with { type: 'json' };
import exampleCancellation from '../../runs/example-cancellation/run.json' with { type: 'json' };
import type { RunRecord } from '../../config/run.generated.js';
import type { ConfigIssue } from '../../config/validate.js';
import type { QualityActor, QualityExecutionResult } from '../quality/execute.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<RunRecord>(schema);

function register(id: string, source: unknown): RunRecord {
  const validation = validateRunRecord(source);
  if (!validation.valid) throw new Error(`Built-in run record "${id}" does not satisfy the run schema.`);
  if (validation.record.id !== id) throw new Error(`Built-in run record "${id}" declares a different identifier.`);
  if (validation.record.kind !== 'example') {
    throw new Error(`Run record "${id}" claims to be recorded. Local records must never ship in the catalog.`);
  }
  return validation.record;
}

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

export function validateRunRecord(input: unknown): RunValidation {
  if (!validateSchema(input)) {
    return {
      valid: false,
      issues: (validateSchema.errors ?? []).map(error => ({
        path: error.instancePath || '/',
        code: `schema.${error.keyword}`,
        message: error.message ?? 'Invalid run record field.',
      })),
    };
  }

  if (input.kind === 'recorded') {
    const started = Date.parse(input.startedAt ?? '');
    const finished = Date.parse(input.finishedAt ?? '');
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
      return {
        valid: false,
        issues: [{ path: '/finishedAt', code: 'run.time_order', message: 'Run finish must not precede its start.' }],
      };
    }
  }
  return { valid: true, record: input };
}

export function isMeasured(record: RunRecord, field: 'inputTokens' | 'outputTokens' | 'costUsd'): boolean {
  return record.measurements?.[field] !== undefined;
}

export function createRunId(): string {
  return `run-${randomUUID()}`;
}

export interface RunRecordInputs {
  id?: string;
  project: string;
  profile: string;
  /** Who the run was authorised as. Recorded so a run says under whose authority it ran. */
  actor: QualityActor;
  execution: QualityExecutionResult;
  retries?: number;
}

/** Builds a recorded run only from the quality executor's result. */
export function buildRunRecord(inputs: RunRecordInputs): RunValidation {
  const record = {
    schemaVersion: 1,
    id: inputs.id ?? createRunId(),
    kind: 'recorded',
    source: 'local-executor',
    task: 'Execute the resolved quality plan.',
    project: inputs.project,
    profile: inputs.profile,
    actor: inputs.actor.kind === 'agent'
      ? { kind: 'agent', role: inputs.actor.role }
      : { kind: 'human-cli' },
    startedAt: inputs.execution.startedAt,
    finishedAt: inputs.execution.finishedAt,
    durationMs: inputs.execution.durationMs,
    finalStatus: inputs.execution.finalStatus,
    retries: inputs.retries ?? 0,
    tools: ['codebase'],
    filesRead: [],
    filesChanged: [],
    gates: inputs.execution.gates.map(gate => ({
      stage: gate.stage,
      title: gate.title,
      outcome: gate.outcome,
      command: gate.command,
      reason: gate.reason,
      ...(gate.execution === undefined ? {} : {
        execution: {
          program: gate.execution.program,
          args: gate.execution.args,
          startedAt: gate.execution.startedAt,
          finishedAt: gate.execution.finishedAt,
          durationMs: gate.execution.durationMs,
          exitCode: gate.execution.exitCode,
          status: gate.execution.status,
          timedOut: gate.execution.timedOut,
          outputTruncated: gate.execution.outputTruncated,
          launcher: gate.execution.launcher,
          ...(gate.execution.unsupportedReason === undefined ? {} : {
            unsupportedReason: gate.execution.unsupportedReason,
          }),
          ...(gate.execution.errorCode === undefined ? {} : { errorCode: gate.execution.errorCode }),
        },
      }),
    })),
    notes: [
      'Produced by the controlled local execution engine.',
      'Command output is intentionally omitted from the persisted record.',
    ],
  };
  return validateRunRecord(record);
}

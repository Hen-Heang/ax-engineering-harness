import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildRunRecord, createRunId, getRun, loadRunRecord, persistRunRecord, validateRunRecord,
  type QualityExecutionResult,
} from '../index.js';

const execution: QualityExecutionResult = {
  startedAt: '2026-09-14T01:00:00.000Z',
  finishedAt: '2026-09-14T01:00:00.125Z',
  durationMs: 125,
  executed: true,
  denied: false,
  finalStatus: 'incomplete',
  gates: [
    {
      stage: 'build', title: 'Build', outcome: 'passed', command: 'node build.js', reason: null,
      execution: {
        command: 'node build.js', program: 'node', args: ['build.js'],
        startedAt: '2026-09-14T01:00:00.000Z', finishedAt: '2026-09-14T01:00:00.100Z',
        durationMs: 100, exitCode: 0, stdout: 'private output', stderr: '', status: 'passed',
        timedOut: false, outputTruncated: false, launcher: 'direct',
      },
    },
    { stage: 'review', title: 'Review', outcome: 'unrun', command: null, reason: 'manual' },
  ],
};

function recorded(id = 'run-test-record') {
  const result = buildRunRecord({ id, project: 'test-project', profile: 'harness-tooling', execution });
  assert.equal(result.valid, true, result.valid ? '' : JSON.stringify(result.issues));
  if (!result.valid) throw new Error('Invalid recorded-run fixture');
  return result.record;
}

test('recorded runs require executor provenance and retain command evidence', () => {
  const record = recorded();
  assert.equal(record.kind, 'recorded');
  assert.equal(record.source, 'local-executor');
  assert.equal(record.project, 'test-project');
  assert.equal(record.finalStatus, 'incomplete');
  assert.equal(record.gates[0]?.execution?.exitCode, 0);
  assert.equal('stdout' in (record.gates[0]?.execution ?? {}), false, 'captured output is not persisted');
  assert.equal('stderr' in (record.gates[0]?.execution ?? {}), false, 'captured output is not persisted');
});

test('recorded-run validation rejects absent provenance and impossible time order', () => {
  const record = recorded();
  const { source: _source, ...withoutSource } = record;
  assert.equal(validateRunRecord(withoutSource).valid, false);
  assert.equal(validateRunRecord({ ...record, finishedAt: '2026-09-13T01:00:00.000Z' }).valid, false);
});

test('shipped examples validate but cannot claim recorded provenance', () => {
  const example = getRun('example-cancellation');
  assert.ok(example);
  assert.equal(validateRunRecord(example).valid, true);
  assert.equal(validateRunRecord({ ...example, source: 'local-executor' }).valid, false);
  assert.equal(validateRunRecord({ ...example, kind: 'recorded' }).valid, false);
});

test('recorded runs persist and reload without accepting overwrite', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ax-run-storage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = recorded();
  const saved = await persistRunRecord(root, record);
  assert.equal(saved.saved, true);
  if (!saved.saved) throw new Error('Run did not persist');
  assert.deepEqual((await loadRunRecord(saved.file)), { valid: true, record });
  assert.deepEqual(await persistRunRecord(root, record), { saved: false, code: 'already-exists' });
  assert.equal((await readdir(join(root, '.ax', 'runs'))).length, 1);
  assert.deepEqual(JSON.parse(await readFile(saved.file, 'utf8')), record);
});

test('storage rejects examples and reports malformed files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ax-run-storage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await persistRunRecord(root, getRun('example-cancellation')), {
    saved: false, code: 'not-recorded',
  });
  const malformed = join(root, 'malformed.json');
  await writeFile(malformed, '{bad json');
  const loaded = await loadRunRecord(malformed);
  assert.equal(loaded.valid, false);
  if (!loaded.valid) assert.equal(loaded.issues[0]?.code, 'run.malformed');
});

test('run identifiers are unique, opaque, and schema-safe', () => {
  const first = createRunId();
  const second = createRunId();
  assert.notEqual(first, second);
  assert.match(first, /^run-[a-f0-9-]{36}$/);
  assert.ok(first.length <= 64);
});

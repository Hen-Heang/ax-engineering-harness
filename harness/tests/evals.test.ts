import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  checkHandoffDocument, evalIds, getEval, getRun, isMeasured, requiredHandoffSections,
  runIds, scoreEval, validateHandoffRecord, validateRunRecord, type EvalDefinition,
} from '../index.js';

const docs = fileURLToPath(new URL('../../docs/', import.meta.url));

function evaluation(id: string): EvalDefinition {
  const definition = getEval(id);
  if (!definition) throw new Error(`Missing eval: ${id}`);
  return definition;
}

const cancellation = evaluation('cancellation-support');
const full = Object.fromEntries(cancellation.scoring.criteria.map(criterion => [criterion.id, 1]));

test('an eval states expected and forbidden behavior and a rubric, but holds no results', () => {
  assert.ok(evalIds.includes('cancellation-support'));
  assert.ok(cancellation.expectedBehaviors.length > 0);
  assert.ok(cancellation.forbiddenBehaviors.length > 0);
  assert.ok(cancellation.scoring.criteria.length > 0);
  assert.ok(cancellation.scoring.passThreshold > 0);
  // A definition must not carry scores; results belong to a run, not to the eval.
  assert.equal('score' in cancellation, false);
  assert.equal('results' in cancellation, false);
});

test('a fully satisfied eval passes, and the threshold decides', () => {
  const perfect = scoreEval(cancellation, full);
  assert.deepEqual(perfect, { percent: 100, passed: true, missing: [], unknown: [] });

  const partial = scoreEval(cancellation, { ...full, scope_discipline: 0, respects_policy: 0 });
  assert.equal(partial.percent, 70);
  assert.equal(partial.passed, false, 'below the declared threshold');
});

test('omitting a criterion scores zero instead of being quietly ignored', () => {
  const omitted = scoreEval(cancellation, { locates_owner: 1, preserves_rules: 1 });
  assert.equal(omitted.percent, 50);
  assert.equal(omitted.passed, false);
  assert.deepEqual(omitted.missing, ['adds_tests', 'scope_discipline', 'respects_policy']);
});

test('forbidden behavior fails an eval even with a perfect score', () => {
  const result = scoreEval(cancellation, full, true);
  assert.equal(result.percent, 100);
  assert.equal(result.passed, false, 'forbidden behavior is disqualifying, not a deduction');
});

test('unknown criteria are reported rather than silently counted', () => {
  const result = scoreEval(cancellation, { ...full, invented_criterion: 1 });
  assert.deepEqual(result.unknown, ['invented_criterion']);
  assert.equal(result.percent, 100);
});

test('every run record shipped here is an example, because nothing has executed', () => {
  assert.ok(runIds.length > 0);
  for (const id of runIds) {
    const record = getRun(id);
    assert.equal(record?.kind, 'example', `${id} must be labelled an example`);
    assert.ok(record?.notes.some(note => /example/i.test(note)), `${id} must say so in its notes`);
  }
});

test('a run claiming to be recorded is rejected while nothing can execute', () => {
  const example = getRun('example-cancellation');
  assert.ok(example);
  assert.equal(validateRunRecord(example).valid, true);

  const fabricated = validateRunRecord({ ...example, kind: 'recorded' });
  assert.equal(fabricated.valid, false);
  if (!fabricated.valid) assert.equal(fabricated.issues[0]?.code, 'run.not_executable');

  assert.equal(validateRunRecord({ ...example, surprise: true }).valid, false);
  assert.equal(validateRunRecord(null).valid, false);
});

test('an unmeasured value is absent rather than zero', () => {
  const record = getRun('example-cancellation');
  assert.ok(record);
  for (const field of ['inputTokens', 'outputTokens', 'costUsd'] as const) {
    assert.equal(isMeasured(record, field), false, `${field} was never measured`);
  }
  // The example distinguishes a gate nobody could run from one that passed.
  assert.equal(record.gates.find(gate => gate.stage === 'integration_tests')?.outcome, 'unavailable');
});

test('a handoff record must state blockers and failed attempts, even when there are none', () => {
  const complete = {
    schemaVersion: 1, id: 'example', goal: 'Demonstrate the contract.', status: 'complete',
    completed: ['Wrote the contract.'], changedFiles: [], decisions: [], blockers: [],
    failedAttempts: [], nextSteps: [], validation: ['Checked by test.'],
  };
  assert.equal(validateHandoffRecord(complete).valid, true);

  for (const field of ['blockers', 'failedAttempts', 'validation', 'nextSteps']) {
    const { [field]: _omitted, ...missing } = complete as Record<string, unknown>;
    assert.equal(validateHandoffRecord(missing).valid, false, `${field} must be stated explicitly`);
  }
});

test('a written handoff is checked for the parts another session needs', () => {
  assert.deepEqual(checkHandoffDocument('nothing here'), [
    'Missing a "Goal:" statement.',
    'Missing a "Status:" statement.',
    ...requiredHandoffSections.map(section => `Missing a "## ${section}" section.`),
  ]);
});

test("this repository's own phase handoffs satisfy the handoff contract", async () => {
  const files = (await readdir(docs)).filter(name => /^phase-\d+-handoff\.md$/.test(name));
  assert.ok(files.length >= 3, 'expected the phase handoffs to be present');
  for (const file of files) {
    const problems = checkHandoffDocument(await readFile(join(docs, file), 'utf8'));
    assert.deepEqual(problems, [], `${file}: ${problems.join(' ')}`);
  }
});

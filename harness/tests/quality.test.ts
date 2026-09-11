import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  canTransition, checkTransition, getState, initialStatuses, isFailurePath, parseProject,
  pipeline, pipelinePassed, planQuality, resolveProject, summarize, workflow, workflowStateIds,
  agentIds, type GateStatus, type ResolvedProject,
} from '../index.js';

const source = await readFile(new URL('../../.ax/project.yaml', import.meta.url), 'utf8');
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

async function resolved(): Promise<ResolvedProject> {
  const parsed = parseProject(source);
  assert.equal(parsed.valid, true);
  if (!parsed.valid) throw new Error('Invalid repository fixture');
  const result = await resolveProject(parsed.config, { root: repositoryRoot });
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error('Repository declaration does not resolve');
  return result.resolved;
}

function statuses(...outcomes: GateStatus['outcome'][]): GateStatus[] {
  return outcomes.map((outcome, index) => ({ stage: `stage-${index}`, outcome }));
}

test('the pipeline plans a resolved project without running anything', async () => {
  const plan = planQuality(await resolved());
  assert.deepEqual(plan.map(entry => entry.stage.id), pipeline.stages.map(stage => stage.id));

  const byStage = new Map(plan.map(entry => [entry.stage.id, entry]));
  assert.equal(byStage.get('build')?.readiness, 'ready');
  assert.equal(byStage.get('build')?.commandSource, 'project');
  assert.equal(byStage.get('build')?.command, 'npm run build');
  // This repository disables lint and integration tests, so they do not apply.
  assert.equal(byStage.get('lint')?.readiness, 'not-applicable');
  assert.equal(byStage.get('integration_tests')?.readiness, 'not-applicable');
  // Review and approval need a person, so they are never merely "ready".
  assert.equal(byStage.get('review')?.readiness, 'manual');
  assert.equal(byStage.get('human_approval')?.readiness, 'manual');
  assert.equal(byStage.get('build')?.stage.kind, 'executable');
});

test('an applicable gate with no command is unavailable, never passed', async () => {
  const base = await resolved();
  const { test: _dropped, ...withoutTest } = base.commands;
  const plan = planQuality({ ...base, commands: withoutTest });
  const unitTests = plan.find(entry => entry.stage.id === 'unit_tests');
  assert.equal(unitTests?.readiness, 'unavailable');
  assert.equal(unitTests?.command, undefined);

  const outcome = initialStatuses(plan).find(status => status.stage === 'unit_tests');
  assert.equal(outcome?.outcome, 'unavailable');
});

test('every gate starts unrun, and unrun is not a pass', async () => {
  const plan = planQuality(await resolved());
  const initial = initialStatuses(plan);
  assert.ok(initial.length > 0);
  assert.ok(initial.every(status => status.outcome === 'unrun'));
  assert.equal(pipelinePassed(initial), false);
  // Gates that do not apply are absent rather than silently counted as passes.
  assert.equal(initial.some(status => status.stage === 'lint'), false);
});

test('only genuinely passed gates make the pipeline pass', () => {
  assert.equal(pipelinePassed(statuses('passed', 'passed')), true);
  assert.equal(pipelinePassed(statuses('passed', 'unrun')), false);
  assert.equal(pipelinePassed(statuses('passed', 'unavailable')), false);
  assert.equal(pipelinePassed(statuses('passed', 'failed')), false);
  assert.equal(pipelinePassed([]), false, 'gating nothing must not report success');
  assert.deepEqual(summarize(statuses('passed', 'failed', 'unrun', 'unrun')),
    { passed: 1, failed: 1, unavailable: 0, unrun: 2 });
});

test('the lifecycle permits only the transitions it declares', () => {
  assert.equal(workflow.initial, 'requirement');
  assert.equal(canTransition('plan', 'implement'), true);
  assert.equal(canTransition('implement', 'verify'), true);
  assert.equal(canTransition('plan', 'verify'), false, 'stages cannot be skipped');
  assert.equal(canTransition('verify', 'requirement'), false);
  assert.equal(canTransition('feedback', 'requirement'), false, 'feedback is terminal for one task');
  assert.equal(canTransition('nowhere', 'plan'), false);
  assert.equal(canTransition('plan', 'nowhere'), false);
});

test('a failure returns to the state that can fix it, and counts as a retry', () => {
  assert.equal(isFailurePath('verify', 'implement'), true);
  assert.equal(isFailurePath('verify', 'review'), false);
  // A rejected approval returns to planning, not straight back to implementation.
  assert.equal(getState('human-approval')?.onFailure, 'plan');
  assert.equal(isFailurePath('human-approval', 'plan'), true);

  assert.deepEqual(checkTransition('verify', 'review', 0, 2), { allowed: true, retry: false });
  assert.deepEqual(checkTransition('verify', 'implement', 0, 2), { allowed: true, retry: true });
});

test('the declared retry limit bounds the failure path', () => {
  assert.equal(checkTransition('verify', 'implement', 1, 2).allowed, true);
  const exhausted = checkTransition('verify', 'implement', 2, 2);
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.retry, true);
  assert.match(exhausted.reason ?? '', /retry limit is exhausted/);
  // A project that allows no retries cannot take a failure path at all.
  assert.equal(checkTransition('verify', 'implement', 0, 0).allowed, false);
});

test('every lifecycle state names real roles and reachable targets', () => {
  for (const id of workflowStateIds) {
    const state = getState(id);
    assert.ok(state, id);
    for (const agent of state?.agents ?? []) assert.ok(agentIds.includes(agent), `${id} names ${agent}`);
    for (const target of state?.next ?? []) assert.ok(workflowStateIds.includes(target), `${id} targets ${target}`);
  }
});

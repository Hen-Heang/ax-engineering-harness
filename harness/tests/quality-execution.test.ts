import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  executeQualityPlan, pipeline, type CommandExecutionResult, type GatePlan,
  type QualityActor, type QualityCommandRunner,
} from '../index.js';

const HUMAN: QualityActor = { kind: 'human-cli' };

function stage(id: string) {
  const found = pipeline.stages.find(item => item.id === id);
  if (!found) throw new Error(`Missing test stage ${id}`);
  return found;
}

function execution(command: string, status: CommandExecutionResult['status']): CommandExecutionResult {
  return {
    command,
    program: 'fixture',
    args: [],
    startedAt: '2026-09-14T00:00:00.000Z',
    finishedAt: '2026-09-14T00:00:00.010Z',
    durationMs: 10,
    exitCode: status === 'passed' ? 0 : status === 'failed' ? 2 : null,
    stdout: '',
    stderr: '',
    status,
    timedOut: status === 'timed-out',
    outputTruncated: false,
    launcher: 'direct',
    ...(status === 'unsupported' ? { unsupportedReason: 'shell-syntax' as const } : {}),
  };
}

function ready(id: string, command = `fixture ${id}`): GatePlan {
  return { stage: stage(id), readiness: 'ready', command, commandSource: 'project' };
}

test('quality execution consumes a plan in order and passes only complete plans', async () => {
  const calls: string[] = [];
  const runner: QualityCommandRunner = async command => {
    calls.push(command);
    return execution(command, 'passed');
  };
  const result = await executeQualityPlan([ready('build'), ready('lint')], {
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, runner,
  });
  assert.deepEqual(calls, ['fixture build', 'fixture lint']);
  assert.deepEqual(result.gates.map(gate => gate.outcome), ['passed', 'passed']);
  assert.equal(result.finalStatus, 'pass');
  assert.equal(result.executed, true);
});

test('quality execution is fail-fast and leaves later commands unrun', async () => {
  const calls: string[] = [];
  const runner: QualityCommandRunner = async command => {
    calls.push(command);
    return execution(command, calls.length === 1 ? 'failed' : 'passed');
  };
  const result = await executeQualityPlan([ready('build'), ready('lint'), ready('typecheck')], {
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, runner,
  });
  assert.deepEqual(calls, ['fixture build']);
  assert.equal(result.gates[0]?.outcome, 'failed');
  assert.equal(result.gates[1]?.outcome, 'unrun');
  assert.equal(result.gates[1]?.reason, 'prior-gate-failed');
  assert.equal(result.finalStatus, 'fail');
});

test('timeouts and infrastructure errors are failures, while unsupported commands are unavailable', async () => {
  for (const status of ['timed-out', 'execution-error'] as const) {
    const result = await executeQualityPlan([ready('build')], {
      root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN,
      runner: async command => execution(command, status),
    });
    assert.equal(result.gates[0]?.outcome, status);
    assert.equal(result.finalStatus, 'fail');
  }

  const unsupported = await executeQualityPlan([ready('build')], {
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN,
    runner: async command => execution(command, 'unsupported'),
  });
  assert.equal(unsupported.gates[0]?.outcome, 'unavailable');
  assert.equal(unsupported.gates[0]?.reason, 'unsupported-command');
  assert.equal(unsupported.finalStatus, 'incomplete');
});

test('manual, unavailable, and planning-only gates remain incomplete and never pass', async () => {
  const manual: GatePlan = { stage: stage('review'), readiness: 'manual' };
  const unavailable: GatePlan = { stage: stage('security'), readiness: 'unavailable' };
  const planned = await executeQualityPlan([ready('build'), manual, unavailable], {
    root: process.cwd(), timeoutSeconds: 30, execute: false, actor: HUMAN,
  });
  assert.deepEqual(planned.gates.map(gate => gate.outcome), ['unrun', 'unrun', 'unavailable']);
  assert.equal(planned.finalStatus, 'incomplete');
  assert.equal(planned.executed, false);
});

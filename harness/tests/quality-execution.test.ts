import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  executeQualityPlan, parseProject, pipeline, type CommandExecutionResult, type GatePlan,
  type ProjectConfig, type QualityActor, type QualityCommandRunner,
} from '../index.js';

const HUMAN: QualityActor = { kind: 'human-cli' };

/** A declaration with every tool on, so these tests isolate gate behaviour. */
const PROJECT: ProjectConfig = (() => {
  const parsed = parseProject(`schemaVersion: 1
project:
  name: quality-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands: {}
tools:
  codebase: { enabled: true }
  docs: { enabled: true }
  github: { enabled: true }
  database: { enabled: true, mode: metadata-only }
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
  build: true
  lint: true
  typecheck: true
  tests: true
  integration_tests: false
  security: false
  review: true
  eval: false
  human_approval: true
limits:
  max_retries: 2
  max_duration_seconds: 60
`);
  if (!parsed.valid) throw new Error('invalid quality fixture');
  return parsed.config;
})();

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
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, project: PROJECT, runner,
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
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, project: PROJECT, runner,
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
      root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, project: PROJECT,
      runner: async command => execution(command, status),
    });
    assert.equal(result.gates[0]?.outcome, status);
    assert.equal(result.finalStatus, 'fail');
  }

  const unsupported = await executeQualityPlan([ready('build')], {
    root: process.cwd(), timeoutSeconds: 30, execute: true, actor: HUMAN, project: PROJECT,
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
    root: process.cwd(), timeoutSeconds: 30, execute: false, actor: HUMAN, project: PROJECT,
  });
  assert.deepEqual(planned.gates.map(gate => gate.outcome), ['unrun', 'unrun', 'unavailable']);
  assert.equal(planned.finalStatus, 'incomplete');
  assert.equal(planned.executed, false);
});

test('the executor decides for itself, so no caller can execute past a denial', async () => {
  /*
   * The point of the boundary is that it cannot be routed around. A caller supplying
   * a runner, an actor, and execute:true still reaches no process when the decision
   * says no — and the refused result carries the decision that refused it.
   */
  let called = 0;
  const runner: QualityCommandRunner = async command => {
    called += 1;
    return execution(command, 'passed');
  };
  const result = await executeQualityPlan([ready('build'), ready('lint')], {
    root: process.cwd(),
    timeoutSeconds: 30,
    execute: true,
    actor: { kind: 'agent', role: 'planner' },
    project: PROJECT,
    runner,
  });

  assert.equal(called, 0, 'nothing may be spawned for an unauthorised actor');
  assert.equal(result.denied, true);
  assert.equal(result.executed, false);
  assert.deepEqual(result.gates.map(gate => gate.outcome), ['unrun', 'unrun']);
  assert.deepEqual(result.gates.map(gate => gate.reason), ['capability-denied', 'capability-denied']);
  assert.equal(result.authorization.outcome, 'denied');
  if (result.authorization.outcome === 'denied') {
    assert.equal(result.authorization.reason, 'actor-lacks-capability');
  }
  assert.equal(result.finalStatus, 'incomplete', 'a denied run is never a pass');
});

test('a disabled codebase tool stops execution, whoever is asking', async () => {
  // The project decides which tools exist. A role cannot switch one on, and neither
  // can the person at the CLI.
  const parsed = parseProject(`schemaVersion: 1
project:
  name: quality-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands: {}
tools:
  codebase: { enabled: false }
  docs: { enabled: true }
  github: { enabled: true }
  database: { enabled: true, mode: metadata-only }
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
  build: true
  lint: false
  typecheck: false
  tests: false
  integration_tests: false
  security: false
  review: true
  eval: false
  human_approval: true
limits:
  max_retries: 2
  max_duration_seconds: 60
`);
  assert.equal(parsed.valid, true);
  if (!parsed.valid) throw new Error('unreachable');

  for (const actor of [HUMAN, { kind: 'agent' as const, role: 'backend-engineer' }]) {
    let called = 0;
    const result = await executeQualityPlan([ready('build')], {
      root: process.cwd(),
      timeoutSeconds: 30,
      execute: true,
      actor,
      project: parsed.config,
      runner: async command => {
        called += 1;
        return execution(command, 'passed');
      },
    });
    assert.equal(called, 0, `${actor.kind} should reach no process`);
    assert.equal(result.denied, true);
    if (result.authorization.outcome === 'denied') {
      assert.equal(result.authorization.reason, 'tool-disabled');
    } else {
      assert.fail('a disabled tool must deny');
    }
  }
});

test('an authorised actor executes, and the decision says why it was permitted', async () => {
  for (const actor of [HUMAN, { kind: 'agent' as const, role: 'qa-reviewer' }]) {
    const result = await executeQualityPlan([ready('build')], {
      root: process.cwd(),
      timeoutSeconds: 30,
      execute: true,
      actor,
      project: PROJECT,
      runner: async command => execution(command, 'passed'),
    });
    assert.equal(result.denied, false);
    assert.equal(result.authorization.outcome, 'allowed');
    assert.equal(result.gates[0]?.outcome, 'passed');
  }
});

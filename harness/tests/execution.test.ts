import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildRunRecord, executeGates, parseProject, resolveExecutable, resolveProject, toArgv,
  validateRunRecord, type ExecutionReport, type GateExecution, type ProjectConfig,
  type ResolvedProject,
} from '../index.js';

/**
 * The gate runner is the only part of the harness that starts a process, so these
 * tests care as much about what it refuses as about what it runs.
 *
 * Every command used here is `node`, which is necessarily present, and every project
 * is a temporary directory. Nothing in these tests touches the preserved Java
 * projects, which must never be built by this workspace.
 */

const base: ProjectConfig = (() => {
  const template = `schemaVersion: 1
project:
  name: exec-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands: {}
tools:
  codebase: { enabled: true }
  docs: { enabled: true }
  github: { enabled: false }
  database: { enabled: false, mode: metadata-only }
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
  build: false
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
`;
  const parsed = parseProject(template);
  if (!parsed.valid) throw new Error('invalid execution fixture');
  return parsed.config;
})();

async function project(
  t: { after(fn: () => unknown): void },
  commands: Record<string, string>,
  gates: Partial<ProjectConfig['quality']>,
  files: Record<string, string> = {},
): Promise<{ resolved: ResolvedProject; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ax-exec-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), '{"name":"fixture","private":true}');
  for (const [name, body] of Object.entries(files)) await writeFile(join(root, name), body);

  const config = structuredClone(base);
  config.commands = commands;
  config.quality = { ...config.quality, ...gates };
  const result = await resolveProject(config, { root });
  assert.equal(result.valid, true, result.valid ? '' : JSON.stringify(result.issues));
  if (!result.valid) throw new Error('unreachable');
  return { resolved: result.resolved, root };
}

function gate(report: ExecutionReport, stage: string): GateExecution | undefined {
  return report.gates.find(entry => entry.stage === stage);
}

test('a command is split into arguments, and shell syntax is refused outright', () => {
  assert.deepEqual(toArgv('npm run build'), { ok: true, argv: ['npm', 'run', 'build'] });
  assert.deepEqual(toArgv('npm audit --omit=dev'), { ok: true, argv: ['npm', 'audit', '--omit=dev'] });

  for (const command of [
    'rm -rf / && echo done', 'echo hi | cat', 'node -e process.exit(1)',
    'cat <file', 'echo $HOME', 'echo `whoami`', 'echo "quoted"', "echo 'quoted'",
    'ls *.ts', 'echo a;b', 'node script.js > out.txt',
  ]) {
    assert.deepEqual(toArgv(command), { ok: false, refusal: 'shell_syntax' }, command);
  }
  assert.deepEqual(toArgv('   '), { ok: false, refusal: 'empty' });
});

test('the executable is resolved without a shell, and a missing one is reported', async () => {
  const found = await resolveExecutable('node', { cwd: process.cwd() });
  assert.ok(found, 'node must resolve on PATH');
  assert.match(found ?? '', /node(\.exe|\.cmd)?$/i);
  assert.equal(await resolveExecutable('definitely-not-installed-xyz', { cwd: process.cwd() }), null);
});

test('reporting runs nothing, which is the default', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: false });

  assert.equal(report.executed, false);
  assert.equal(report.denied, false);
  assert.equal(gate(report, 'build')?.outcome, 'unrun');
  assert.equal(gate(report, 'build')?.refusal, 'not-executed');
  assert.equal(gate(report, 'build')?.exitCode, null);
});

test('a role without the capability runs nothing, even when asked to execute', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'planner', execute: true });

  assert.equal(report.denied, true);
  assert.equal(report.executed, false);
  assert.equal(gate(report, 'build')?.outcome, 'unrun');
  assert.equal(gate(report, 'build')?.refusal, 'capability-denied');
  assert.equal(gate(report, 'build')?.exitCode, null, 'nothing should have run');
});

test('an unknown role is denied rather than defaulted', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'not-a-role', execute: true });
  assert.equal(report.denied, true);
  assert.equal(gate(report, 'build')?.refusal, 'capability-denied');
});

test('a successful command passes and a failing one fails', async t => {
  const { resolved, root } = await project(
    t,
    { build: 'node --version', test: 'node fail.js' },
    { build: true, tests: true },
    { 'fail.js': 'process.exit(3)\n' },
  );
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: true });

  assert.equal(report.executed, true);
  const build = gate(report, 'build');
  assert.equal(build?.outcome, 'passed');
  assert.equal(build?.exitCode, 0);
  assert.ok((build?.output ?? '').includes('v'), 'output should be captured');

  const tests = gate(report, 'unit_tests');
  assert.equal(tests?.outcome, 'failed');
  assert.equal(tests?.exitCode, 3);
  assert.equal(tests?.timedOut, false);
});

test('a command needing a shell is unavailable, never run another way', async t => {
  const { resolved, root } = await project(t, { build: 'node -e process.exit(0)' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: true });
  assert.equal(gate(report, 'build')?.outcome, 'unavailable');
  assert.equal(gate(report, 'build')?.refusal, 'shell-syntax');
  assert.equal(gate(report, 'build')?.exitCode, null);
});

test('a command whose executable is absent is unavailable, not failed', async t => {
  const { resolved, root } = await project(t, { build: 'definitely-not-installed-xyz --version' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: true });
  assert.equal(gate(report, 'build')?.outcome, 'unavailable');
  assert.equal(gate(report, 'build')?.refusal, 'executable-not-found');
});

test('a command that overruns the declared limit is killed and reported', async t => {
  const { resolved, root } = await project(
    t,
    { build: 'node sleep.js' },
    { build: true },
    { 'sleep.js': 'setTimeout(function () {}, 30000)\n' },
  );
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: true, timeoutSeconds: 1 });
  const build = gate(report, 'build');
  assert.equal(build?.timedOut, true);
  assert.equal(build?.outcome, 'failed', 'a killed command has not passed');
});

test('gates needing a person are reported as unrun rather than attempted', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const report = await executeGates(resolved, { root, agent: 'qa-reviewer', execute: true });
  for (const stage of ['review', 'human_approval']) {
    assert.equal(gate(report, stage)?.outcome, 'unrun', stage);
    assert.equal(gate(report, stage)?.refusal, 'manual', stage);
  }
  // A gate the project disabled is absent entirely, not reported as anything.
  assert.equal(gate(report, 'lint'), undefined);
});

test('a recorded run is now valid, which the earlier refusal was waiting for', () => {
  const example = {
    schemaVersion: 1, id: 'recorded-example', kind: 'recorded',
    task: 'Run the declared quality gates.', agent: 'qa-reviewer', profile: 'harness-tooling',
    status: 'completed', retries: 0, tools: ['codebase'], filesRead: [], filesChanged: [],
    gates: [{ stage: 'build', outcome: 'passed' }], notes: ['Produced by the gate runner.'],
  };
  assert.equal(validateRunRecord(example).valid, true);
});

test('a built record reports the real outcome and leaves unmeasured fields absent', () => {
  const allPassed = buildRunRecord({
    id: 'run-all-passed', task: 'Run the declared quality gates.', agent: 'qa-reviewer',
    profile: 'harness-tooling', tools: ['codebase'],
    gates: [{ stage: 'build', outcome: 'passed' }],
    notes: ['Produced by the gate runner.'],
  });
  assert.equal(allPassed.valid, true);
  if (allPassed.valid) {
    assert.equal(allPassed.record.kind, 'recorded');
    assert.equal(allPassed.record.status, 'completed');
    assert.equal(allPassed.record.measurements, undefined, 'unmeasured means absent');
    assert.equal(allPassed.record.durationSeconds, undefined);
    assert.deepEqual(allPassed.record.filesChanged, []);
  }

  // One unrun gate is enough to stop the run being reported as completed.
  const mixed = buildRunRecord({
    id: 'run-mixed', task: 'Run the declared quality gates.', agent: 'qa-reviewer',
    profile: 'harness-tooling', tools: ['codebase'],
    gates: [{ stage: 'build', outcome: 'passed' }, { stage: 'review', outcome: 'unrun' }],
    notes: ['Produced by the gate runner.'],
    durationSeconds: 12,
  });
  assert.equal(mixed.valid, true);
  if (mixed.valid) {
    assert.equal(mixed.record.status, 'failed');
    assert.equal(mixed.record.durationSeconds, 12);
  }

  // A run with no gates at all has not completed either.
  const empty = buildRunRecord({
    id: 'run-empty', task: 'Run the declared quality gates.', agent: 'qa-reviewer',
    profile: 'harness-tooling', tools: [], gates: [], notes: ['Nothing applied.'],
  });
  assert.equal(empty.valid, true);
  if (empty.valid) assert.equal(empty.record.status, 'failed');
});

test('validation and resolution cannot reach the runner', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { join } = await import('node:path');

  const root = fileURLToPath(new URL('../', import.meta.url));
  async function sources(directory: string): Promise<string[]> {
    const found: string[] = [];
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) found.push(...await sources(path));
      else if (item.name.endsWith('.ts')) found.push(path);
    }
    return found;
  }

  // Loading a declaration must stay free of effects, so the modules that do it may
  // not import the module that starts processes. Only the CLI wires the two together.
  const guarded = [
    ...await sources(join(root, 'config')),
    ...await sources(join(root, 'core', 'profiles')),
    ...await sources(join(root, 'core', 'quality')),
    ...await sources(join(root, 'core', 'context')),
  ];
  assert.ok(guarded.length > 0);
  for (const file of guarded) {
    const code = await readFile(file, 'utf8');
    assert.equal(code.includes('execution/'), false, `${file} must not reach the runner`);
    assert.equal(code.includes('child_process'), false, `${file} must not spawn`);
  }
});

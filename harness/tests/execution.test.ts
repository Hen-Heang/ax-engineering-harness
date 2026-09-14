import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  executeQualityPlan, parseProject, planQuality, resolveExecutable, resolveProject, toArgv,
  type ProjectConfig, type QualityActor, type QualityExecutionResult, type QualityGateResult,
  type ResolvedProject,
} from '../index.js';

/**
 * The quality executor is the only part of the harness that starts a process, so these
 * tests care as much about what it refuses as about what it runs.
 *
 * Every command used here is `node`, which is necessarily present, and every project
 * is a temporary directory. Nothing in these tests touches the preserved Java
 * projects, which must never be built by this workspace.
 */

const HUMAN: QualityActor = { kind: 'human-cli' };

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

/** Plans and then executes, which is the pairing the CLI performs. */
async function run(
  resolved: ResolvedProject,
  root: string,
  options: { execute: boolean; actor?: QualityActor; timeoutSeconds?: number },
): Promise<QualityExecutionResult> {
  return executeQualityPlan(planQuality(resolved), {
    root,
    timeoutSeconds: options.timeoutSeconds ?? resolved.config.limits.max_duration_seconds,
    execute: options.execute,
    actor: options.actor ?? HUMAN,
  });
}

function gate(result: QualityExecutionResult, stage: string): QualityGateResult | undefined {
  return result.gates.find(entry => entry.stage === stage);
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

test('on Windows a launcher wins over the extensionless script beside it', async t => {
  /*
   * Node and Gradle both ship a POSIX shell script next to the Windows launcher:
   * `npm` beside `npm.cmd`, `gradlew` beside `gradlew.bat`. The bare file exists and
   * is a regular file, but CreateProcess cannot run it, so preferring it produces a
   * misleading "not found" long after the lookup. PATHEXT must win.
   */
  const root = await mkdtemp(join(tmpdir(), 'ax-pathext-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'tool'), '#!/bin/sh\n');
  await writeFile(join(root, 'tool.CMD'), '@echo off\n');

  const env = { PATH: root, PATHEXT: '.COM;.EXE;.BAT;.CMD' };
  assert.equal(
    await resolveExecutable('tool', { cwd: root, env, platform: 'win32' }),
    join(root, 'tool.CMD'),
  );
  // A name that already carries a known extension is taken exactly as written.
  assert.equal(
    await resolveExecutable('tool.CMD', { cwd: root, env, platform: 'win32' }),
    join(root, 'tool.CMD'),
  );
});

test('reporting runs nothing, which is the default', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, { execute: false });

  assert.equal(result.executed, false);
  assert.equal(result.denied, false);
  assert.equal(gate(result, 'build')?.outcome, 'unrun');
  assert.equal(gate(result, 'build')?.reason, 'not-executed');
  assert.equal(gate(result, 'build')?.execution, undefined);
});

test('a role without the capability runs nothing, even when asked to execute', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, { execute: true, actor: { kind: 'agent', role: 'planner' } });

  assert.equal(result.denied, true);
  assert.equal(result.executed, false);
  assert.equal(gate(result, 'build')?.outcome, 'unrun');
  assert.equal(gate(result, 'build')?.reason, 'capability-denied');
  assert.equal(gate(result, 'build')?.execution, undefined, 'nothing should have run');
  assert.equal(result.finalStatus, 'incomplete', 'a denied run has not passed');
});

test('an unknown role is denied rather than defaulted', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, { execute: true, actor: { kind: 'agent', role: 'not-a-role' } });
  assert.equal(result.denied, true);
  assert.equal(gate(result, 'build')?.reason, 'capability-denied');
});

test('a role holding the capability may execute', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, {
    execute: true,
    actor: { kind: 'agent', role: 'backend-engineer' },
  });
  assert.equal(result.denied, false);
  assert.equal(gate(result, 'build')?.outcome, 'passed');
});

test('a successful command passes and a failing one fails', async t => {
  const { resolved, root } = await project(
    t,
    { build: 'node --version', test: 'node fail.js' },
    { build: true, tests: true },
    { 'fail.js': 'process.exit(3)\n' },
  );
  const result = await run(resolved, root, { execute: true });

  assert.equal(result.executed, true);
  const build = gate(result, 'build');
  assert.equal(build?.outcome, 'passed');
  assert.equal(build?.execution?.exitCode, 0);
  assert.ok((build?.execution?.stdout ?? '').includes('v'), 'output should be captured');

  const tests = gate(result, 'unit_tests');
  assert.equal(tests?.outcome, 'failed');
  assert.equal(tests?.execution?.exitCode, 3);
  assert.equal(tests?.execution?.timedOut, false);
  assert.equal(result.finalStatus, 'fail');
});

test('a command needing a shell is unavailable, never run another way', async t => {
  const { resolved, root } = await project(t, { build: 'node -e process.exit(0)' }, { build: true });
  const result = await run(resolved, root, { execute: true });
  assert.equal(gate(result, 'build')?.outcome, 'unavailable');
  assert.equal(gate(result, 'build')?.reason, 'unsupported-command');
  assert.equal(gate(result, 'build')?.execution?.exitCode, null);
  assert.equal(gate(result, 'build')?.execution?.program, null, 'no process was started');
});

test('a command whose executable is absent is unavailable, not failed', async t => {
  const { resolved, root } = await project(t, { build: 'definitely-not-installed-xyz --version' }, { build: true });
  const result = await run(resolved, root, { execute: true });
  assert.equal(gate(result, 'build')?.outcome, 'unavailable');
  assert.equal(gate(result, 'build')?.reason, 'executable-not-found');
  assert.equal(result.finalStatus, 'incomplete', 'an absent tool says nothing about the code');
});

test('a command that overruns the declared limit is killed and reported', async t => {
  const { resolved, root } = await project(
    t,
    { build: 'node sleep.js' },
    { build: true },
    { 'sleep.js': 'setTimeout(function () {}, 30000)\n' },
  );
  const result = await run(resolved, root, { execute: true, timeoutSeconds: 1 });
  const build = gate(result, 'build');
  assert.equal(build?.execution?.timedOut, true);
  assert.equal(build?.outcome, 'timed-out', 'a killed command has not passed');
  assert.equal(result.finalStatus, 'fail');
});

test('gates needing a person are reported as unrun rather than attempted', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, { execute: true });
  for (const stage of ['review', 'human_approval']) {
    assert.equal(gate(result, stage)?.outcome, 'unrun', stage);
    assert.equal(gate(result, stage)?.reason, 'manual', stage);
  }
  // A gate the project disabled is absent entirely, not reported as anything.
  assert.equal(gate(result, 'lint'), undefined);
  assert.equal(result.finalStatus, 'incomplete', 'a manual gate keeps the run incomplete');
});

test('the resolved absolute path never reaches a result, because it can name a user', async t => {
  const { resolved, root } = await project(t, { build: 'node --version' }, { build: true });
  const result = await run(resolved, root, { execute: true });
  assert.equal(gate(result, 'build')?.execution?.program, 'node');
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
    join(root, 'core', 'quality', 'plan.ts'),
    ...await sources(join(root, 'core', 'context')),
  ];
  assert.ok(guarded.length > 0);
  for (const file of guarded) {
    const code = await readFile(file, 'utf8');
    assert.equal(code.includes('execution/'), false, `${file} must not reach the runner`);
    assert.equal(code.includes('child_process'), false, `${file} must not spawn`);
  }
});

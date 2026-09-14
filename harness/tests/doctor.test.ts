import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectProject, type DoctorReport, type QualityActor } from '../index.js';

/**
 * The doctor reports what it can see without starting anything, so these tests care
 * most about two things: that it stays useful when a project is *not* ready, which is
 * the case it exists for, and that it never runs a command to find out.
 */

const HUMAN: QualityActor = { kind: 'human-cli' };

interface Declaration {
  commands?: Record<string, string>;
  context?: Record<string, string>;
  quality?: Record<string, boolean>;
  tools?: { codebase?: boolean; docs?: boolean; github?: boolean; database?: boolean };
}

async function fixture(
  t: { after(fn: () => unknown): void },
  declaration: Declaration | string | null,
  files: Record<string, string> = {},
): Promise<{ file: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ax-doctor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.ax'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"name":"fixture","private":true}');
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(root, name, '..'), { recursive: true });
    await writeFile(join(root, name), body);
  }

  const file = join(root, '.ax', 'project.yaml');
  if (declaration === null) return { file, root };
  if (typeof declaration === 'string') {
    await writeFile(file, declaration);
    return { file, root };
  }

  const quality = {
    build: true, lint: false, typecheck: false, tests: true,
    integration_tests: false, security: false, review: true, eval: false, human_approval: true,
    ...declaration.quality,
  };
  const tools = { codebase: true, docs: true, github: false, database: false, ...declaration.tools };
  const commands = Object.entries(declaration.commands ?? {})
    .map(([key, value]) => `  ${key}: ${value}`).join('\n');
  const context = Object.entries(declaration.context ?? {})
    .map(([key, value]) => `  ${key}: ${value}`).join('\n');

  await writeFile(file, `schemaVersion: 1
project:
  name: doctor-fixture
  mode: single-repo
  profile: harness-tooling
context:
${context || '  {}'}
commands:
${commands || '  {}'}
tools:
  codebase: { enabled: ${tools.codebase} }
  docs: { enabled: ${tools.docs} }
  github: { enabled: ${tools.github} }
  database: { enabled: ${tools.database}, mode: metadata-only }
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
${Object.entries(quality).map(([key, value]) => `  ${key}: ${value}`).join('\n')}
limits:
  max_retries: 2
  max_duration_seconds: 60
`);
  return { file, root };
}

function gate(report: DoctorReport, stage: string) {
  return report.quality.find(entry => entry.stage === stage);
}

test('a project with no declaration is reported as unadopted, not as a broken file', async t => {
  /*
   * The ordinary state of a project that has not adopted the harness. Calling this an
   * encoding failure would misdiagnose the most common case the command will see.
   */
  const { file, root } = await fixture(t, null);
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.configuration.status, 'fail');
  assert.equal(report.configuration.issues[0]?.code, 'file.missing');
  assert.match(report.recommendations[0] ?? '', /has not adopted the harness yet/);
  assert.equal(report.project, undefined, 'nothing is claimed about a project that was never read');
});

test('an invalid declaration reports its issues and stops rather than guessing', async t => {
  const { file, root } = await fixture(t, 'schemaVersion: 1\nproject: {}\n');
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.configuration.status, 'fail');
  assert.ok(report.configuration.issues.length > 0);
  assert.deepEqual(report.quality, [], 'no gate can be described before the declaration loads');
});

test('an unknown profile fails resolution but still reports what was declared', async t => {
  /*
   * Resolution failing is not a reason to say nothing. The tools and context are in
   * the declaration and are exactly what a person needs to see to fix it.
   */
  const { file, root } = await fixture(t, `schemaVersion: 1
project:
  name: doctor-fixture
  mode: single-repo
  profile: no-such-profile
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
`);
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.configuration.status, 'fail');
  assert.equal(report.project, 'doctor-fixture');
  assert.equal(report.tools.length, 4, 'declared tools are still reportable');
  assert.equal(report.execution, undefined, 'nothing is claimed about running gates');
});

test('command availability distinguishes configured, unsupported, and not installed', async t => {
  const { file, root } = await fixture(t, {
    commands: {
      build: 'node --version',
      test: 'definitely-not-installed-xyz run',
      lint: 'node -e process.exit(0)',
    },
    quality: { build: true, tests: true, lint: true },
  });
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.configuration.status, 'pass');
  assert.equal(gate(report, 'build')?.availability, 'available');
  assert.equal(gate(report, 'unit_tests')?.availability, 'not-installed');
  assert.equal(gate(report, 'lint')?.availability, 'unsupported');
  // Switched off, and a person's gate, neither of which is a missing command.
  assert.equal(gate(report, 'security')?.availability, 'disabled');
  assert.equal(gate(report, 'review')?.availability, 'manual');

  assert.equal(report.execution?.runnable, 1);
  assert.equal(report.execution?.expected, 3, 'disabled and manual gates expect no command');
});

test('an enabled gate with no command anywhere is a configuration failure, not a gate state', async t => {
  /*
   * Worth pinning, because it is the rule that makes `not-configured` unreachable
   * in practice: validation refuses a declaration that enables a gate nothing can
   * run, so the doctor reports a broken configuration rather than a gate that is
   * merely waiting for a command. Failing here is better than resolving into a
   * pipeline with a hole in it.
   */
  const { file, root } = await fixture(t, {
    commands: { build: 'node --version' },
    // integration_tests is supplied by neither the declaration nor harness-tooling.
    quality: { build: true, integration_tests: true },
  });
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.configuration.status, 'fail');
  assert.ok(
    report.configuration.issues.some(issue => issue.code === 'command.required'),
    'the failure must name the missing command',
  );
});

test('the doctor starts no process, even for a command that would fail loudly', async t => {
  /*
   * `ax doctor` must be safe to run against a repository nobody has read. A command
   * that writes a file proves the difference between looking one up and running it.
   */
  const { file, root } = await fixture(
    t,
    { commands: { build: 'node side-effect.js' }, quality: { build: true } },
    { 'side-effect.js': "require('node:fs').writeFileSync('executed.txt', 'ran');\n" },
  );
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(gate(report, 'build')?.availability, 'available');
  const { access } = await import('node:fs/promises');
  await assert.rejects(access(join(root, 'executed.txt')), 'the command must not have run');
});

test('context findings separate a missing reference from an absent one', async t => {
  const { file, root } = await fixture(
    t,
    { context: { architecture: 'docs/architecture.md', domain: 'docs/gone.md' } },
    { 'docs/architecture.md': '# Architecture\n' },
  );
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(report.context.find(entry => entry.key === 'architecture')?.status, 'present');
  assert.equal(report.context.find(entry => entry.key === 'domain')?.status, 'missing');
  assert.equal(report.context.find(entry => entry.key === 'database'), undefined);

  assert.ok(report.recommendations.some(item => /Fix the domain context/.test(item)));
  assert.ok(report.recommendations.some(item => /Add database context/.test(item)));
  assert.equal(
    report.recommendations.some(item => /Add architecture context/.test(item)),
    false,
    'a declared and resolving reference needs no recommendation',
  );
});

test('a disabled codebase tool is reported as blocking execution, not as a passing gate', async t => {
  const { file, root } = await fixture(t, {
    commands: { build: 'node --version' },
    quality: { build: true },
    tools: { codebase: false },
  });
  const report = await inspectProject({ file, root, actor: HUMAN });

  assert.equal(gate(report, 'build')?.availability, 'available', 'the command itself is still findable');
  assert.equal(report.execution?.authorization, 'denied (tool-disabled)');
  assert.ok(report.recommendations.some(item => /no gate would run/.test(item)));
});

test('recommendations only ever name something the report observed', async t => {
  const { file, root } = await fixture(
    t,
    {
      commands: { build: 'node --version', test: 'node --version' },
      context: { architecture: 'a.md', domain: 'd.md', database: 'db.md' },
      quality: { build: true, tests: true },
    },
    { 'a.md': '#\n', 'd.md': '#\n', 'db.md': '#\n' },
  );
  const report = await inspectProject({ file, root, actor: HUMAN });

  // Everything declared resolves and runs, so the only thing left is the eval gap.
  assert.deepEqual(report.recommendations, []);
  assert.equal(report.evals > 0, true, 'this repository ships an eval definition');
});

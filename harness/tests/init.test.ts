import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { applyInit, inspectProject, planInit, toProjectName, type QualityActor } from '../index.js';

/**
 * `ax init` is the first command that writes to someone else's repository, so these
 * tests care most about what it refuses to touch, and about whether what it produces
 * actually works. A generated declaration that then fails validation would make a
 * schema error the first experience of the harness.
 */

const HUMAN: QualityActor = { kind: 'human-cli' };

async function project(
  t: { after(fn: () => unknown): void },
  files: Record<string, string>,
  directory = 'demo-service',
): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'ax-init-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, directory);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(root, { recursive: true });
  for (const [name, body] of Object.entries(files)) await writeFile(join(root, name), body);
  return root;
}

const POM = '<project><modelVersion>4.0.0</modelVersion></project>\n';

test('planning proposes files without creating any of them', async t => {
  const root = await project(t, { 'pom.xml': POM, 'mvnw.cmd': '@echo off\n' });
  const plan = await planInit({ root });

  assert.deepEqual(plan.detection.manifests, ['pom.xml']);
  assert.equal(plan.profile?.id, 'java-spring');
  assert.equal(plan.profile?.source, 'detected');
  assert.equal(plan.name, 'demo-service');
  assert.deepEqual(
    plan.files.map(file => file.path),
    ['.ax/project.yaml', '.ax/context/architecture.md', '.ax/context/domain.md',
      '.ax/context/database.md', 'AGENTS.md'],
  );
  assert.ok(plan.files.every(file => file.status === 'create'));

  // The whole point of a plan: the directory is untouched until something applies it.
  assert.deepEqual(await readdir(root), ['mvnw.cmd', 'pom.xml']);
});

test('what init generates validates, resolves, and passes the doctor', async t => {
  /*
   * The strongest thing this phase can assert. A template that produced a
   * declaration the harness then rejected would be worse than no template.
   */
  const root = await project(t, { 'pom.xml': POM, 'mvnw.cmd': '@echo off\n', mvnw: '#!/bin/sh\n' });
  const applied = await applyInit(await planInit({ root }));
  assert.equal(applied.complete, true);

  const report = await inspectProject({
    file: join(root, '.ax', 'project.yaml'),
    root,
    actor: HUMAN,
  });
  assert.equal(report.configuration.status, 'pass', JSON.stringify(report.configuration.issues));
  assert.equal(report.profile?.id, 'java-spring');
  assert.equal(report.buildSystem?.id, 'maven');
  assert.equal(report.buildSystem?.wrapper, true);
  // Every declared context reference resolves, because init wrote the files too.
  assert.deepEqual(report.context.map(entry => entry.status), ['present', 'present', 'present']);
  // Only the gates java-spring supplies a command for are enabled, so none is
  // enabled without something to run.
  assert.equal(report.quality.find(gate => gate.stage === 'build')?.availability, 'available');
  assert.equal(report.quality.find(gate => gate.stage === 'lint')?.availability, 'disabled');
});

test('an existing file is kept, and AGENTS.md gets a template beside it instead', async t => {
  const root = await project(t, {
    'pom.xml': POM,
    'AGENTS.md': '# Existing instructions\n\nWork nobody wants merged automatically.\n',
  });
  const plan = await planInit({ root });

  const agents = plan.files.find(file => file.path === 'AGENTS.md');
  assert.equal(agents?.status, 'exists');
  const template = plan.files.find(file => file.path === '.ax/AGENTS.template.md');
  assert.equal(template?.status, 'create', 'a template is offered rather than a merge');

  await applyInit(plan);
  assert.equal(
    await readFile(join(root, 'AGENTS.md'), 'utf8'),
    '# Existing instructions\n\nWork nobody wants merged automatically.\n',
    'the existing file must be byte-for-byte unchanged',
  );
  assert.ok((await readFile(join(root, '.ax', 'AGENTS.template.md'), 'utf8')).includes('Merge into your own'));
});

test('a file appearing between planning and writing is still not overwritten', async t => {
  /*
   * Refusing to overwrite is a property of the `wx` open flag rather than of a check
   * performed while planning, so a file created in between is safe too.
   */
  const root = await project(t, { 'pom.xml': POM });
  const plan = await planInit({ root });
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(root, '.ax'), { recursive: true });
  await writeFile(join(root, '.ax', 'project.yaml'), 'written by somebody else\n');

  const applied = await applyInit(plan);
  assert.equal(applied.complete, false);
  assert.equal(
    applied.written.find(result => result.path === '.ax/project.yaml')?.outcome,
    'skipped-exists',
  );
  assert.equal(await readFile(join(root, '.ax', 'project.yaml'), 'utf8'), 'written by somebody else\n');
});

test('several build systems refuse a recommendation rather than picking one', async t => {
  const root = await project(t, { 'pom.xml': POM, 'package.json': '{"name":"x","private":true}\n' });
  const plan = await planInit({ root });

  assert.equal(plan.profile, null);
  assert.ok(plan.blockers.some(item => /Choose one with --profile/.test(item)));
  assert.deepEqual(plan.files, [], 'a plan with blockers proposes nothing');
  assert.deepEqual(await applyInit(plan), { written: [], complete: false });
});

test('no manifest, and an unknown profile, each refuse rather than guess', async t => {
  const bare = await project(t, { 'readme.txt': 'nothing here\n' });
  const none = await planInit({ root: bare });
  assert.equal(none.profile, null);
  assert.ok(none.blockers.some(item => /No build manifest was found/.test(item)));

  const unknown = await planInit({ root: bare, profile: 'no-such-profile' });
  assert.ok(unknown.blockers.some(item => /Unknown profile/.test(item)));
  assert.deepEqual(unknown.files, []);
});

test('a composed profile is refused, because it cannot come from one directory', async t => {
  const root = await project(t, { 'pom.xml': POM });
  const plan = await planInit({ root, profile: 'fullstack' });
  assert.ok(plan.blockers.some(item => /composes several build roots/.test(item)));
  assert.deepEqual(plan.files, []);
});

test('a directory name that cannot be a project name asks for one', async t => {
  assert.equal(toProjectName('/tmp/My Service'), 'my-service');
  assert.equal(toProjectName('/tmp/123'), null, 'a name must start with a letter');
  assert.equal(toProjectName('/tmp/___'), null);

  const root = await project(t, { 'pom.xml': POM }, '123');
  const plan = await planInit({ root });
  assert.ok(plan.blockers.some(item => /Pass --name/.test(item)));

  const named = await planInit({ root, name: 'chosen-name' });
  assert.deepEqual(named.blockers, []);
  assert.ok(named.files.some(file => file.contents.includes('name: chosen-name')));
});

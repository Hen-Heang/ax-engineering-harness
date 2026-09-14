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
    ['.ax/project.yaml', '.ax/.gitignore', '.ax/context/architecture.md',
      '.ax/context/domain.md', '.ax/context/database.md', 'AGENTS.md'],
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
  // A gate is enabled only where the profile or the project supplies a command, so
  // none is ever enabled without something to run. This pom declares nothing, so
  // only the profile's gates are on.
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

test('generated commands come from the project manifest, not only the profile', async t => {
  /*
   * The regression this exists for. A declaration built from the profile alone
   * switched off tests in a repository with a test script, and the doctor then had
   * to report an omission the generator had just created.
   */
  const root = await project(t, {
    'package.json': JSON.stringify({
      name: 'ui', private: true,
      scripts: { build: 'next build', test: 'vitest run', lint: 'eslint .', 'test:e2e': 'playwright test' },
    }),
  });
  const plan = await planInit({ root });
  const declaration = plan.files.find(file => file.path === '.ax/project.yaml')?.contents ?? '';

  assert.match(declaration, /^ {2}build: npm run build$/m);
  assert.match(declaration, /^ {2}test: npm test$/m, 'npm test is the built-in spelling');
  assert.match(declaration, /^ {2}lint: npm run lint$/m);
  assert.match(declaration, /^ {2}integration_test: npm run test:e2e$/m);
  // Every detected command switches its gate on, or declaring it would be pointless.
  assert.match(declaration, /^ {2}tests: true$/m);
  assert.match(declaration, /^ {2}lint: true$/m);
  assert.match(declaration, /^ {2}integration_tests: true$/m);
});

test('a Maven project with failsafe gets an integration command using its own wrapper', async t => {
  const wrapper = process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw';
  const root = await project(t, {
    'pom.xml': `<project><build><plugins><plugin>
      <artifactId>maven-failsafe-plugin</artifactId></plugin></plugins></build></project>\n`,
    [wrapper]: '@echo off\n',
  });
  const plan = await planInit({ root });
  const declaration = plan.files.find(file => file.path === '.ax/project.yaml')?.contents ?? '';

  assert.match(declaration, /^ {2}integration_test: .*verify$/m);
  // The wrapper this checkout actually has, in this platform's form — not a bare
  // `mvn` that may not be on PATH.
  const expected = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
  assert.ok(
    declaration.includes(`integration_test: ${expected} `),
    `expected the ${expected} wrapper form in:
${declaration}`,
  );
  assert.match(declaration, /^ {2}integration_tests: true$/m);
});

test('a project whose manifest declares nothing keeps the profile defaults alone', async t => {
  const root = await project(t, {
    'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>\n',
  });
  const plan = await planInit({ root });
  const declaration = plan.files.find(file => file.path === '.ax/project.yaml')?.contents ?? '';

  assert.match(declaration, /^commands:\n {2}\{\}$/m, 'nothing is invented');
  assert.match(declaration, /^ {2}integration_tests: false$/m);
  assert.match(declaration, /^ {2}build: true$/m, 'the profile still supplies build');
});

test('a script name a shell would read is refused rather than declared', async t => {
  const root = await project(t, {
    'package.json': JSON.stringify({
      name: 'x', private: true, scripts: { build: 'tsc', 'lint && rm -rf /': 'evil' },
    }),
  });
  const plan = await planInit({ root });
  const declaration = plan.files.find(file => file.path === '.ax/project.yaml')?.contents ?? '';
  assert.doesNotMatch(declaration, /rm -rf/);
  assert.match(declaration, /^ {2}lint: false$/m);
});

test('adoption keeps recorded runs out of the project history', async t => {
  /*
   * Executing gates writes a run record under .ax/runs/. That is local evidence about
   * one machine at one moment, and committing it would put a claim about a run into a
   * history that cannot verify it. The rule lives inside .ax rather than being
   * appended to the project's own .gitignore, because init must never modify a file
   * the project already owns.
   */
  const root = await project(t, { 'pom.xml': POM });
  const plan = await planInit({ root });

  const ignore = plan.files.find(file => file.path === '.ax/.gitignore');
  assert.equal(ignore?.status, 'create');
  assert.match(ignore?.contents ?? '', /^runs\/$/m);

  await applyInit(plan);
  assert.match(await readFile(join(root, '.ax', '.gitignore'), 'utf8'), /^runs\/$/m);
});

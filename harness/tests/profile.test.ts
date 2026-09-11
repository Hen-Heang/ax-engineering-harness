import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  getProfile, parseProject, profileIds, resolveProject,
  type ProfileDefinition, type ProjectConfig,
} from '../index.js';

const source = await readFile(new URL('../../.ax/project.yaml', import.meta.url), 'utf8');
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

function fixture(): ProjectConfig {
  const result = parseProject(source);
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error('Invalid repository fixture');
  return structuredClone(result.config);
}

/** A Java/Spring declaration that relies on the profile for its commands. */
function javaProject(): ProjectConfig {
  const config = fixture();
  config.project.profile = 'java-spring';
  config.context = {};
  config.commands = {};
  config.quality = {
    ...config.quality,
    build: true, lint: false, typecheck: false, tests: true,
    integration_tests: false, security: false, eval: false,
  };
  return config;
}

async function root(t: { after(fn: () => unknown): void }, files: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ax-profile-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const file of files) await writeFile(join(directory, file), '');
  return directory;
}

function profile(id: string): ProfileDefinition {
  const definition = getProfile(id);
  if (!definition) throw new Error(`Missing built-in profile: ${id}`);
  return definition;
}

test('every built-in profile is registered under its own identifier and documents its limits', () => {
  assert.ok(profileIds.length > 0);
  for (const id of profileIds) {
    const definition = profile(id);
    assert.equal(definition.id, id);
    assert.equal(definition.schemaVersion, 1);
    assert.ok(definition.architecture.length > 0, `${id} must state architecture assumptions`);
    assert.ok(definition.limitations.length > 0, `${id} must state limitations`);
  }
});

test('an unknown profile fails resolution instead of being ignored', async t => {
  const directory = await root(t, ['pom.xml']);
  const config = javaProject();
  config.project.profile = 'does-not-exist';
  const result = await resolveProject(config, { root: directory, platform: 'posix' });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.issues[0]?.code, 'profile.unknown');
    assert.equal(result.issues[0]?.path, '/project/profile');
  }
});

test('profile defaults supply commands the declaration omitted', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw', 'mvnw.cmd']);
  const result = await resolveProject(javaProject(), { root: directory, platform: 'posix' });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.resolved.commands.build, {
    command: './mvnw -B --no-transfer-progress package -DskipTests',
    source: 'profile',
  });
  assert.equal(result.resolved.commands.test?.source, 'profile');
  assert.equal(result.resolved.config.commands.build, './mvnw -B --no-transfer-progress package -DskipTests');
  // The profile defines no default for these, so nothing is invented.
  assert.equal(result.resolved.commands.integration_test, undefined);
  assert.equal(result.resolved.commands.security, undefined);
});

test('a declared command always wins over the profile default', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw']);
  const config = javaProject();
  config.commands.build = 'make build';
  const result = await resolveProject(config, { root: directory, platform: 'posix' });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.resolved.commands.build, { command: 'make build', source: 'project' });
  assert.equal(result.resolved.commands.test?.source, 'profile');
});

test('an enabled gate the profile cannot supply fails after resolution', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw']);
  const config = javaProject();
  config.quality.integration_tests = true;
  const result = await resolveProject(config, { root: directory, platform: 'posix' });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.issues.some(issue => issue.path === '/commands/integration_test' && issue.code === 'command.required'));
  }
});

test('resolution adds commands only, and never mutates or weakens the declaration', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw']);
  const config = javaProject();
  const before = structuredClone(config);
  const result = await resolveProject(config, { root: directory, platform: 'posix' });
  assert.deepEqual(config, before, 'input declaration must not be mutated');
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const resolved = result.resolved.config;
  assert.deepEqual(resolved.permissions, before.permissions);
  assert.deepEqual(resolved.quality, before.quality);
  assert.deepEqual(resolved.tools, before.tools);
  assert.deepEqual(resolved.limits, before.limits);
  assert.deepEqual(resolved.project, before.project);
  assert.deepEqual(resolved.context, before.context);
});

test('resolved commands use the platform form of the wrapper', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw', 'mvnw.cmd']);
  for (const [platform, expected] of [['posix', './mvnw'], ['windows', 'mvnw.cmd']] as const) {
    const result = await resolveProject(javaProject(), { root: directory, platform });
    assert.equal(result.valid, true);
    if (result.valid) assert.ok(result.resolved.config.commands.build?.startsWith(`${expected} `), platform);
  }
});

test('ambiguous build evidence fails resolution until the project selects one', async t => {
  const directory = await root(t, ['pom.xml', 'build.gradle', 'gradlew']);
  const ambiguous = await resolveProject(javaProject(), { root: directory, platform: 'posix' });
  assert.equal(ambiguous.valid, false);
  if (!ambiguous.valid) assert.equal(ambiguous.issues[0]?.code, 'buildsystem.ambiguous');

  const config = javaProject();
  config.project.build_system = 'gradle';
  const selected = await resolveProject(config, { root: directory, platform: 'posix' });
  assert.equal(selected.valid, true);
  if (selected.valid) {
    assert.equal(selected.resolved.buildSystem, 'gradle');
    assert.equal(selected.resolved.config.commands.build, './gradlew build -x test');
  }
});

test('this repository resolves against its own profile and keeps its declared commands', async () => {
  const result = await resolveProject(fixture(), { root: repositoryRoot });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.resolved.profile.id, 'harness-tooling');
  assert.equal(result.resolved.buildSystem, 'node');
  for (const [slot, resolved] of Object.entries(result.resolved.commands)) {
    assert.equal(resolved.source, 'project', `${slot} is declared explicitly by this repository`);
  }
});

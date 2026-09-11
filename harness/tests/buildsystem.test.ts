import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectBuildSystems, getProfile, selectBuildSystem, type ProfileDefinition } from '../index.js';

function profile(id: string): ProfileDefinition {
  const definition = getProfile(id);
  if (!definition) throw new Error(`Missing built-in profile: ${id}`);
  return definition;
}

const java = profile('java-spring');

async function root(t: { after(fn: () => unknown): void }, files: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ax-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const file of files) await writeFile(join(directory, file), '');
  return directory;
}

test('detection reads the selected root only and never recurses into nested projects', async t => {
  const directory = await root(t, ['pom.xml']);
  const nested = join(directory, 'nested');
  await mkdir(nested);
  await writeFile(join(nested, 'build.gradle'), '');
  assert.deepEqual(await detectBuildSystems(java, directory), ['maven']);
});

test('ambiguous manifests fail rather than choosing a build system', async t => {
  const directory = await root(t, ['pom.xml', 'build.gradle']);
  assert.deepEqual(await detectBuildSystems(java, directory), ['maven', 'gradle']);
  const ambiguous = await selectBuildSystem(java, directory, undefined, 'posix');
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.issues[0]?.code, 'buildsystem.ambiguous');

  const selected = await selectBuildSystem(java, directory, 'gradle', 'posix');
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.id, 'gradle');
});

test('an absent manifest fails instead of assuming a build system', async t => {
  const directory = await root(t, []);
  const result = await selectBuildSystem(java, directory, undefined, 'posix');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.issues[0]?.code, 'buildsystem.undetected');
});

test('explicit selection must be both supported by the profile and evidenced on disk', async t => {
  const directory = await root(t, ['pom.xml']);
  const unsupported = await selectBuildSystem(java, directory, 'node', 'posix');
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.issues[0]?.code, 'buildsystem.unsupported');

  const missing = await selectBuildSystem(java, directory, 'gradle', 'posix');
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.issues[0]?.code, 'buildsystem.manifest_missing');
});

test('Maven runner uses the platform wrapper form when present and otherwise falls back', async t => {
  const bare = await root(t, ['pom.xml']);
  for (const platform of ['posix', 'windows'] as const) {
    const result = await selectBuildSystem(java, bare, undefined, platform);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.runner, { command: 'mvn', availability: 'path-unverified' });
  }

  const wrapped = await root(t, ['pom.xml', 'mvnw', 'mvnw.cmd']);
  const posix = await selectBuildSystem(java, wrapped, undefined, 'posix');
  assert.equal(posix.ok, true);
  if (posix.ok) assert.deepEqual(posix.runner, { command: './mvnw', availability: 'wrapper-present' });
  const windows = await selectBuildSystem(java, wrapped, undefined, 'windows');
  assert.equal(windows.ok, true);
  if (windows.ok) assert.deepEqual(windows.runner, { command: 'mvnw.cmd', availability: 'wrapper-present' });
});

test('a wrapper present for one platform only does not imply the other platform form', async t => {
  const directory = await root(t, ['pom.xml', 'mvnw']);
  const posix = await selectBuildSystem(java, directory, undefined, 'posix');
  assert.equal(posix.ok, true);
  if (posix.ok) assert.equal(posix.runner.availability, 'wrapper-present');
  const windows = await selectBuildSystem(java, directory, undefined, 'windows');
  assert.equal(windows.ok, true);
  if (windows.ok) assert.deepEqual(windows.runner, { command: 'mvn', availability: 'path-unverified' });
});

test('Gradle Groovy and Kotlin layouts both resolve, with platform wrapper forms', async t => {
  for (const manifest of ['build.gradle', 'build.gradle.kts']) {
    const directory = await root(t, [manifest, 'gradlew', 'gradlew.bat']);
    assert.deepEqual(await detectBuildSystems(java, directory), ['gradle']);
    const posix = await selectBuildSystem(java, directory, undefined, 'posix');
    assert.equal(posix.ok, true);
    if (posix.ok) assert.equal(posix.runner.command, './gradlew');
    const windows = await selectBuildSystem(java, directory, undefined, 'windows');
    assert.equal(windows.ok, true);
    if (windows.ok) assert.equal(windows.runner.command, 'gradlew.bat');
  }
});

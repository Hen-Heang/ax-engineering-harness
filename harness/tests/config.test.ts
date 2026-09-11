import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { stringify } from 'yaml';
import { checkContextFiles, loadProject, parseProject, validateProject } from '../index.js';
import { MAX_CONFIG_BYTES } from '../config/load.js';

const source = await readFile(new URL('../../.ax/project.yaml', import.meta.url), 'utf8');
function fixture() {
  const result = parseProject(source);
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error('Invalid repository fixture');
  return structuredClone(result.config);
}

test('repository configuration validates without mutation', () => {
  const config = fixture();
  const before = structuredClone(config);
  assert.equal(validateProject(config).valid, true);
  assert.deepEqual(config, before);
});

test('unknown fields, malformed types, missing fields, and unsupported versions fail', () => {
  const invalid = [
    null, [], {}, { ...fixture(), schemaVersion: 2 },
    { ...fixture(), surprise: true },
    { ...fixture(), project: { name: 'demo', mode: 'multi-repo', profile: 'java-spring' } },
    { ...fixture(), tools: { ...fixture().tools, github: { enabled: 'true' } } },
    { ...fixture(), tools: { ...fixture().tools, github: { enabled: true, token: 'DO-NOT-PRINT' } } },
    { ...fixture(), commands: { build: '  ' } },
    { ...fixture(), limits: { max_retries: -1, max_duration_seconds: 0 } },
  ];
  for (const config of invalid) assert.equal(validateProject(config).valid, false);
  assert.ok(!JSON.stringify(validateProject(invalid[7])).includes('DO-NOT-PRINT'));
});

test('each high-impact permission is denied by the v1 schema', () => {
  for (const permission of Object.keys(fixture().permissions)) {
    const config = fixture();
    Object.assign(config.permissions, { [permission]: true });
    assert.equal(validateProject(config).valid, false, permission);
  }
});

test('review and human approval cannot be disabled', () => {
  for (const gate of ['review', 'human_approval']) {
    const config = fixture();
    Object.assign(config.quality, { [gate]: false });
    assert.equal(validateProject(config).valid, false);
  }
});

test('each enabled executable gate requires its declared command', () => {
  const pairs = { build: 'build', lint: 'lint', typecheck: 'typecheck', tests: 'test', integration_tests: 'integration_test', security: 'security' } as const;
  for (const [gate, command] of Object.entries(pairs)) {
    const config = fixture();
    Object.assign(config.quality, { [gate]: true });
    delete config.commands[command];
    const result = validateProject(config);
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.issues.some(issue => issue.path === `/commands/${command}`));
  }
});

test('context paths reject traversal and absolute paths on either platform', () => {
  for (const path of ['../private.md', 'docs/../../private.md', '/private.md', 'C:/private.md', '\\\\host\\private.md', 'docs\\file.md', 'https://host/file.md', 'docs/./file.md', 'docs/file.txt']) {
    const config = fixture();
    config.context.architecture = path;
    assert.equal(validateProject(config).valid, false, path);
  }
  const config = fixture();
  config.context.architecture = 'docs/Architecture #1.md';
  assert.equal(validateProject(config).valid, true);
});

test('declared context requires docs capability', () => {
  const config = fixture();
  config.tools.docs.enabled = false;
  assert.equal(validateProject(config).valid, false);
});

test('YAML parser rejects ambiguous or unsupported input without echoing values', () => {
  for (const yaml of [
    'a: 1\na: 2', 'a: [', 'a: !!unknown DO-NOT-PRINT',
    'a: &ref hello\nb: *ref', 'a: 1\n---\nb: 2', 'x'.repeat(MAX_CONFIG_BYTES + 1),
  ]) {
    const result = parseProject(yaml);
    assert.equal(result.valid, false);
    assert.ok(!JSON.stringify(result).includes('DO-NOT-PRINT'));
  }
});

test('configuration loading never executes declared commands', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ax-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = fixture();
  config.commands.build = 'definitely-not-an-installed-command --must-not-run';
  const path = join(directory, 'project.yaml');
  await writeFile(path, stringify(config));
  assert.equal((await loadProject(path)).valid, true);
  assert.equal((await loadProject(join(directory, 'missing.yaml'))).valid, false);
  assert.equal((await loadProject(directory)).valid, false);
  await writeFile(path, Buffer.alloc(MAX_CONFIG_BYTES + 1));
  assert.equal((await loadProject(path)).valid, false);
  await writeFile(path, Buffer.from([0xff, 0xfe]));
  assert.equal((await loadProject(path)).valid, false);
});

test('context check detects missing files, directories, and symlink escape', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ax-context-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'project');
  const outside = join(directory, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'secret.md'), 'not to be loaded');
  const config = fixture();
  config.context.architecture = 'missing.md';
  assert.equal((await checkContextFiles(config, root))[0]?.code, 'context.unavailable');
  await mkdir(join(root, 'directory.md'));
  config.context.architecture = 'directory.md';
  assert.equal((await checkContextFiles(config, root))[0]?.code, 'context.not_file');
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  config.context.architecture = 'linked/secret.md';
  assert.equal((await checkContextFiles(config, root))[0]?.code, 'context.outside_root');
  await writeFile(join(root, 'safe.md'), '# Context');
  config.context.architecture = 'safe.md';
  assert.deepEqual(await checkContextFiles(config, root), []);
});

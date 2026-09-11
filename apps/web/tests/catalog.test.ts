import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { adapterIds, agentIds, evalIds, profileIds, runIds, skillIds } from '@ax-harness/core';
import { capabilities, catalog, catalogKinds, catalogSummary, entriesOfKind, findEntry } from '../lib/catalog';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const statuses = new Set(['implemented', 'experimental', 'planned']);

/**
 * Identifiers that would give the browser filesystem reach. The console must never
 * import them, because every one of them reads from disk.
 */
const forbidden = [
  'node:fs', 'node:child_process', 'node:process', 'fs/promises',
  'loadProject', 'resolveProject', 'checkContextFiles',
  'detectBuildSystems', 'selectBuildSystem', 'checkEvidence', 'directoryExists',
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
}

async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...await sourceFiles(path));
    else if (/\.tsx?$/.test(item.name)) found.push(path);
  }
  return found;
}

test('the catalog exposes every registered definition and nothing else', () => {
  assert.deepEqual(catalog.profile.map(item => item.id), [...profileIds]);
  assert.deepEqual(catalog.agent.map(item => item.id), [...agentIds]);
  assert.deepEqual(catalog.skill.map(item => item.id), [...skillIds]);
  assert.deepEqual(catalog.adapter.map(item => item.id), [...adapterIds]);
  assert.deepEqual(catalog.eval.map(item => item.id), [...evalIds]);
  assert.deepEqual(catalog.run.map(item => item.id), [...runIds]);
  assert.equal(catalog.policy.length, 1);
  assert.equal(catalog.pipeline.length, 1);
  assert.equal(catalog.workflow.length, 1);
  assert.equal(catalogSummary.total, catalogKinds.reduce((sum, kind) => sum + catalog[kind].length, 0));
});

test('every entry is complete, serializable, and labelled with a known status', () => {
  for (const kind of catalogKinds) {
    for (const item of entriesOfKind(kind)) {
      assert.equal(item.kind, kind);
      assert.ok(item.id.length > 0, `${kind} id`);
      assert.ok(item.title.length > 0, `${kind}/${item.id} title`);
      assert.ok(item.summary.length > 0, `${kind}/${item.id} summary`);
      assert.ok(item.status === null || statuses.has(item.status), `${kind}/${item.id} status`);
      // Entries cross the server-to-client boundary, so they must survive a round trip.
      assert.deepEqual(JSON.parse(JSON.stringify(item.definition)), item.definition);
    }
  }
});

test('displayed source is rendered from the definition rather than read from disk', () => {
  for (const kind of catalogKinds) {
    for (const item of entriesOfKind(kind)) {
      assert.deepEqual(JSON.parse(item.source), item.definition, `${kind}/${item.id}`);
      assert.ok(item.source.endsWith('\n'));
    }
  }
});

test('an unknown kind or identifier reaches no data', () => {
  assert.equal(findEntry('profile', 'java-spring')?.id, 'java-spring');
  assert.equal(findEntry('profile', 'does-not-exist'), undefined);
  assert.equal(findEntry('not-a-kind', 'java-spring'), undefined);
  assert.equal(findEntry('__proto__', 'anything'), undefined);
  assert.equal(findEntry('constructor', 'anything'), undefined);
});

test('the shipped console never imports anything that reads the filesystem', async () => {
  const files = [...await sourceFiles(join(webRoot, 'app')), ...await sourceFiles(join(webRoot, 'lib'))];
  assert.ok(files.length > 0, 'expected source files to scan');
  for (const file of files) {
    const code = stripComments(await readFile(file, 'utf8'));
    for (const token of forbidden) {
      assert.equal(code.includes(token), false, `${file} must not reference ${token}`);
    }
  }
});

test('nothing in the catalog leaks a local path, legacy project, or environment file', () => {
  const serialized = JSON.stringify(catalog);
  for (const pattern of [/[A-Za-z]:[\\/]/, /\/home\//, /\/Users\//, /node_modules/, /\.env/]) {
    assert.equal(pattern.test(serialized), false, `catalog must not contain ${pattern}`);
  }
  for (const project of ['AuthHub', 'heang-api-center', 'heang-dev-lab', 'spring-boot-lab']) {
    assert.equal(serialized.includes(project), false, `catalog must not mention ${project}`);
  }
});

test('the capability matrix travels with the catalog and still denies what it must', () => {
  assert.ok(capabilities.length > 0);
  for (const row of capabilities) {
    if (row.capability.deniedToAllAgents) assert.deepEqual(row.agents, [], row.capability.id);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(capabilities)), capabilities);
});

test('every run the console can display is an example, never a claimed execution', () => {
  assert.ok(catalog.run.length > 0);
  for (const item of catalog.run) {
    assert.match(item.summary, /^example run/);
  }
});

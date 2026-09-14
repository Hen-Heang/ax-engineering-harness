import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
function run(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'harness/cli/index.ts', ...args], { cwd: root, encoding: 'utf8' });
}

test('CLI validates the repository declaration and states its execution boundary', () => {
  const result = run('validate');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No commands were run/);
});

test('CLI returns nonzero for missing configuration and invalid usage', () => {
  assert.equal(run('validate', 'missing.yaml').status, 1);
  assert.equal(run('run').status, 2);
  assert.equal(run('quality', '--unknown').status, 2);
  assert.equal(run('validate', 'one', 'two').status, 2);
});

test('CLI prints the capability matrix and says which part of it is enforced', () => {
  const result = run('policy');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Only run_tests is enforced, by the gate runner. The rest are declarations./);
  assert.match(result.stdout, /database_write\s+high\s+database\s+denied to every agent/);
  assert.match(result.stdout, /create_pull_request.*human approval required/);
  assert.equal(run('policy', 'extra').status, 2);
});

test('CLI prints the quality plan and refuses to call an unrun gate a pass', () => {
  const result = run('quality');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pipeline passed: false/);
  assert.match(result.stdout, /unrun is not a pass/);
  assert.match(result.stdout, /eval\s+not-applicable/);
  assert.match(result.stdout, /build\s+ready\s+project\s+npm run build/);
  assert.match(result.stdout, /lint\s+ready\s+project\s+npm run lint/);
  assert.match(result.stdout, /integration_tests\s+ready\s+project\s+npm run e2e/);
  assert.equal(run('quality', 'one', 'two').status, 2);
});

test('CLI keeps execution behind the quality --execute flag', () => {
  const result = run('quality');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No gate was executed/);
  assert.doesNotMatch(result.stdout, /AX Quality Run/);
});

test('CLI executes quality commands and reports manual gates as incomplete', t => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'ax-quality-cli-'));
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  mkdirSync(join(projectRoot, '.ax'));
  writeFileSync(join(projectRoot, 'package.json'), '{"name":"quality-fixture","private":true}');
  writeFileSync(join(projectRoot, 'pass.js'), "process.stdout.write('verified');\n");
  writeFileSync(join(projectRoot, '.ax', 'project.yaml'), `schemaVersion: 1
project:
  name: quality-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands:
  build: node pass.js
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
  max_retries: 0
  max_duration_seconds: 10
`);

  const result = run('quality', '--execute', join(projectRoot, '.ax', 'project.yaml'));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /AX Quality Run/);
  assert.match(result.stdout, /Project: quality-fixture/);
  assert.match(result.stdout, /BUILD[\s\S]*Status: PASSED/);
  assert.match(result.stdout, /INDEPENDENT REVIEW[\s\S]*Status: UNRUN[\s\S]*Manual/);
  assert.match(result.stdout, /FINAL RESULT\s+INCOMPLETE/);
  assert.match(result.stdout, /Recorded:/);
  const files = readdirSync(join(projectRoot, '.ax', 'runs'));
  assert.equal(files.length, 1);
  const record = JSON.parse(readFileSync(join(projectRoot, '.ax', 'runs', files[0] ?? ''), 'utf8'));
  assert.equal(record.kind, 'recorded');
  assert.equal(record.source, 'local-executor');
  assert.equal(record.finalStatus, 'incomplete');
});

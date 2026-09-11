import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  assert.equal(run('validate', 'one', 'two').status, 2);
});

test('CLI prints the capability matrix and states that nothing enforces it', () => {
  const result = run('policy');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Nothing enforces them/);
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

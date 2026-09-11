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
  // "run" used to be an unknown command; it is a real one now, so this asserts
  // against a command that is still unknown.
  assert.equal(run('execute').status, 2);
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

test('CLI reports gates without running them unless asked', () => {
  const result = run('run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Reporting only\. Pass --execute to run these commands\./);
  assert.match(result.stdout, /No command was executed\./);
  assert.match(result.stdout, /build\s+unrun\s+not-executed\s+npm run build/);
});

test('CLI refuses to run gates as a role without the capability', () => {
  const result = run('run', '--as', 'planner');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /planner does not hold run_tests, so nothing was run\./);
  assert.match(result.stdout, /capability-denied/);
  assert.match(result.stdout, /No command was executed\./);
});

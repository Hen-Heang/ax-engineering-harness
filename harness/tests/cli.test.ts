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

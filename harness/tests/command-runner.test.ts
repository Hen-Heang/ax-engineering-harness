import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCommand, runCommand } from '../index.js';

async function fixture(t: { after(fn: () => unknown): void }, files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'ax-command-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries(files)) await writeFile(join(root, name), contents);
  return root;
}

test('parser produces a program and argument vector for supported commands', () => {
  assert.deepEqual(parseCommand('npm run build'), {
    supported: true,
    command: { program: 'npm', args: ['run', 'build'] },
  });
  assert.deepEqual(parseCommand('./gradlew test'), {
    supported: true,
    command: { program: './gradlew', args: ['test'] },
  });
});

test('parser rejects shell operators, redirection, substitution, and quotes', () => {
  for (const command of [
    'one | two', 'one || two', 'one && two', 'one; two', 'one > file', 'one >> file',
    'one < file', 'echo $(whoami)', 'echo `whoami`', 'echo "two words"', "echo 'two words'",
  ]) {
    assert.deepEqual(parseCommand(command), { supported: false, reason: 'shell-syntax' }, command);
  }
});

test('runner captures separate output and reports a successful duration', async t => {
  const root = await fixture(t, {
    'success.js': "process.stdout.write('out'); process.stderr.write('err'); setTimeout(() => {}, 30);\n",
  });
  const result = await runCommand('node success.js', { cwd: root, timeoutSeconds: 5 });
  assert.equal(result.status, 'passed');
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'out');
  assert.equal(result.stderr, 'err');
  assert.equal(result.program, 'node');
  assert.deepEqual(result.args, ['success.js']);
  assert.ok(result.durationMs >= 0);
  assert.ok(Date.parse(result.finishedAt) >= Date.parse(result.startedAt));
  assert.equal(result.outputTruncated, false);
});

test('runner distinguishes a nonzero exit from an execution error', async t => {
  const root = await fixture(t, { 'fail.js': "process.stderr.write('failure'); process.exit(7);\n" });
  const failed = await runCommand('node fail.js', { cwd: root, timeoutSeconds: 5 });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.exitCode, 7);
  assert.equal(failed.stderr, 'failure');

  const missing = await runCommand('definitely-not-installed-ax-command', { cwd: root, timeoutSeconds: 5 });
  assert.equal(missing.status, 'execution-error');
  assert.equal(missing.exitCode, null);
  assert.equal(missing.errorCode, 'ENOENT');
  assert.equal(missing.stderr, '', 'OS error messages and paths are not copied into output');
});

test('runner returns unsupported without starting a process', async t => {
  const root = await fixture(t, {});
  const result = await runCommand('node okay.js && node other.js', { cwd: root, timeoutSeconds: 5 });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.unsupportedReason, 'shell-syntax');
  assert.equal(result.program, null);
});

test('a spawn that throws synchronously is reported, not propagated', { skip: process.platform !== 'win32' }, async t => {
  /*
   * Since Node 18.20, spawning a Windows `.cmd` or `.bat` with shell:false throws
   * EINVAL synchronously rather than emitting `error`, because batch files can only
   * run through cmd.exe and their quoting is unsafe (CVE-2024-27980). Refusing is
   * right; taking the calling process down with it is not.
   */
  const root = await fixture(t, { 'tool.cmd': '@echo off\r\necho hi\r\n' });
  const result = await runCommand('./tool.cmd', { cwd: root, timeoutSeconds: 5 });
  assert.equal(result.status, 'execution-error');
  assert.equal(result.errorCode, 'EINVAL');
  assert.equal(result.exitCode, null);
  assert.equal(result.program, './tool.cmd', 'the declared name, not a resolved absolute path');
});

test('runner terminates a command after its timeout', async t => {
  const root = await fixture(t, { 'wait.js': 'setTimeout(() => {}, 30000);\n' });
  const result = await runCommand('node wait.js', { cwd: root, timeoutSeconds: 0.05 });
  assert.equal(result.status, 'timed-out');
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 5000);
});

test('runner bounds retained stdout and stderr together and marks truncation', async t => {
  const root = await fixture(t, {
    'output.js': "process.stdout.write('a'.repeat(40)); process.stderr.write('b'.repeat(40));\n",
  });
  const result = await runCommand('node output.js', {
    cwd: root,
    timeoutSeconds: 5,
    maxOutputBytes: 32,
  });
  assert.equal(result.status, 'passed');
  assert.equal(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr), 32);
  assert.equal(result.outputTruncated, true);
});

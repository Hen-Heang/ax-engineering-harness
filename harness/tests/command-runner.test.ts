import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildBatchCommandLine, parseCommand, runCommand } from '../index.js';

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
    // cmd.exe's own expansion and escape characters, refused so a batch launcher
    // can be reached through cmd.exe without any token meaning anything to it.
    'echo %PATH%', 'echo a^b',
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

test('the batch command line survives a path with spaces, with or without arguments', () => {
  /*
   * With `/s`, cmd.exe strips the first and last character of the string after `/c`
   * when both are quotes, and takes the rest verbatim. The outer pair exists so that
   * a command with no arguments has *that* pair stripped rather than the quotes
   * around the path, which would then break on its first space.
   */
  assert.equal(
    buildBatchCommandLine('C:\\Program Files\\nodejs\\npm.CMD', ['run', 'build']),
    '""C:\\Program Files\\nodejs\\npm.CMD" run build"',
  );
  assert.equal(
    buildBatchCommandLine('C:\\Program Files\\nodejs\\npm.CMD', []),
    '""C:\\Program Files\\nodejs\\npm.CMD""',
  );
});

test('a Windows batch launcher runs through cmd.exe, and says so', { skip: process.platform !== 'win32' }, async t => {
  /*
   * npm, gradlew and mvnw are all batch files on Windows, and since Node 18.20 spawn
   * refuses to start one directly (CVE-2024-27980). Reaching them through an argv
   * this module builds is not the same as `shell: true`, which would hand cmd.exe
   * the declared command string to re-parse. The record says which happened.
   */
  const root = await fixture(t, { 'tool.cmd': '@echo off\r\necho ran %1\r\n' });
  const result = await runCommand('./tool.cmd alpha', { cwd: root, timeoutSeconds: 20 });
  assert.equal(result.status, 'passed');
  assert.equal(result.exitCode, 0);
  assert.equal(result.launcher, 'cmd.exe');
  assert.match(result.stdout, /ran alpha/);
  assert.equal(result.program, './tool.cmd', 'the declared name, not a resolved absolute path');
});

test('a batch file that fails still reports a failure, not an execution error', { skip: process.platform !== 'win32' }, async t => {
  const root = await fixture(t, { 'bad.cmd': '@echo off\r\nexit /b 5\r\n' });
  const result = await runCommand('./bad.cmd', { cwd: root, timeoutSeconds: 20 });
  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 5);
  assert.equal(result.launcher, 'cmd.exe');
});

test('an ordinary executable is started directly, without any interpreter', async t => {
  const root = await fixture(t, { 'ok.js': 'process.exit(0);\n' });
  const result = await runCommand('node ok.js', { cwd: root, timeoutSeconds: 5 });
  assert.equal(result.status, 'passed');
  assert.equal(result.launcher, 'direct');
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

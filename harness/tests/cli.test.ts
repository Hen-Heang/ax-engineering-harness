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
  assert.match(result.stdout, /Only run_tests is enforced, and only where an agent actor asks the/);
  assert.match(result.stdout, /Every other row is a declaration nothing yet checks./);
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

test('CLI doctor reports a project factually and runs no command', () => {
  const result = run('doctor');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AX Project Doctor/);
  assert.match(result.stdout, /profile\s+harness-tooling/);
  assert.match(result.stdout, /Build\s+AVAILABLE/);
  assert.match(result.stdout, /github\s+DISABLED/);
  assert.match(result.stdout, /authorization\s+allowed/);
  assert.match(result.stdout, /No project command was executed/);
  // No invented readiness score. Diagnostics are factual or they are not offered.
  assert.equal(/\b\d{1,3}%/.test(result.stdout), false, 'the doctor must not score readiness');
  assert.equal(run('doctor', '--nope').status, 2);
});

test('CLI doctor exits nonzero for a project that has not adopted the harness', () => {
  const result = run('doctor', 'no-such-project/.ax/project.yaml');
  assert.equal(result.status, 1, 'an unusable project is a failure, not a clean report');
  assert.match(result.stdout, /project.yaml\s+FAIL/);
  assert.match(result.stdout, /has not adopted the harness yet/);
});

test('CLI init plans without writing, and only writes when told to', t => {
  const base = mkdtempSync(join(tmpdir(), 'ax-init-cli-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const projectRoot = join(base, 'demo-service');
  mkdirSync(projectRoot);
  writeFileSync(join(projectRoot, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>\n');

  const planned = run('init', projectRoot);
  assert.equal(planned.status, 0, planned.stderr);
  assert.match(planned.stdout, /Profile: java-spring \(detected\)/);
  assert.match(planned.stdout, /create\s+\.ax\/project\.yaml/);
  assert.match(planned.stdout, /Nothing was written/);
  assert.deepEqual(readdirSync(projectRoot), ['pom.xml'], 'planning must create nothing');

  const written = run('init', '--write', projectRoot);
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stdout, /written\s+\.ax\/project\.yaml/);
  assert.deepEqual(readdirSync(projectRoot).sort(), ['.ax', '.claude', 'AGENTS.md', 'pom.xml']);

  // The generated declaration is immediately usable, which is the point of it.
  const doctor = run('doctor', join(projectRoot, '.ax', 'project.yaml'));
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout, /project\.yaml\s+PASS/);

  // Re-running writes nothing further and replaces nothing.
  const again = run('init', '--write', projectRoot);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /skipped-exists\s+\.ax\/project\.yaml/);
});

test('CLI init refuses to choose between build systems', t => {
  const base = mkdtempSync(join(tmpdir(), 'ax-init-cli-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const projectRoot = join(base, 'ambiguous-service');
  mkdirSync(projectRoot);
  writeFileSync(join(projectRoot, 'pom.xml'), '<project/>\n');
  writeFileSync(join(projectRoot, 'package.json'), '{"name":"x","private":true}\n');

  const result = run('init', projectRoot);
  assert.equal(result.status, 1, 'an ambiguous root is a failure, not a guess');
  assert.match(result.stdout, /Choose one with --profile/);
  assert.deepEqual(readdirSync(projectRoot).sort(), ['package.json', 'pom.xml']);
});

test('CLI doctor refuses a clean bill of health for a project that can do more', t => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'ax-unclaimed-'));
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  mkdirSync(join(projectRoot, '.ax'));
  writeFileSync(
    join(projectRoot, 'package.json'),
    JSON.stringify({ name: 'f', private: true, scripts: { build: 'tsc', test: 'vitest run' } }),
  );
  writeFileSync(join(projectRoot, '.ax', 'project.yaml'), `schemaVersion: 1
project:
  name: unclaimed-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands:
  build: node --version
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
  max_retries: 2
  max_duration_seconds: 60
`);

  const result = run('doctor', join(projectRoot, '.ax', 'project.yaml'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Unit tests\s+DISABLED/);
  assert.match(result.stdout, /\^ but package\.json declares a "test" script/);
  assert.match(result.stdout, /Enable Unit tests/);
  assert.doesNotMatch(result.stdout, /nothing outstanding/, 'this project is not in good shape');
});

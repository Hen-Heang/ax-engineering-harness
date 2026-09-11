import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  agentIds, analyzeImpact, getProfile, isComposed, parseProject, profileIds, resolveProject,
  type ProfileDefinition, type ProjectConfig, type ResolvedProject,
} from '../index.js';

const source = await readFile(new URL('../../.ax/project.yaml', import.meta.url), 'utf8');

function profile(id: string): ProfileDefinition {
  const definition = getProfile(id);
  if (!definition) throw new Error(`Missing built-in profile: ${id}`);
  return definition;
}

function project(id: string, commands: Record<string, string>, gates: Record<string, boolean>): ProjectConfig {
  const parsed = parseProject(source);
  assert.equal(parsed.valid, true);
  if (!parsed.valid) throw new Error('Invalid repository fixture');
  const config = structuredClone(parsed.config);
  config.project.profile = id;
  config.context = {};
  config.commands = commands;
  config.quality = {
    ...config.quality,
    build: false, lint: false, typecheck: false, tests: false,
    integration_tests: false, security: false, eval: false,
    ...gates,
  };
  return config;
}

async function tree(t: { after(fn: () => unknown): void }, files: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ax-compose-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [directory, names] of Object.entries(files)) {
    const target = directory === '.' ? root : join(root, directory);
    if (directory !== '.') await mkdir(target, { recursive: true });
    for (const name of names) await writeFile(join(target, name), '');
  }
  return root;
}

async function resolvedOk(config: ProjectConfig, root: string): Promise<ResolvedProject> {
  const result = await resolveProject(config, { root, platform: 'posix' });
  assert.equal(result.valid, true, result.valid ? '' : JSON.stringify(result.issues));
  if (!result.valid) throw new Error('unreachable');
  return result.resolved;
}

test('the Next.js profile supplies only commands such a project reliably has', async t => {
  const root = await tree(t, { '.': ['package.json', 'next.config.mjs'] });
  const resolved = await resolvedOk(
    project('nextjs-react', {}, { build: true, security: true }),
    root,
  );

  assert.equal(resolved.commands.build?.command, 'npm run build');
  assert.equal(resolved.commands.build?.source, 'profile');
  assert.equal(resolved.commands.security?.command, 'npm audit --omit=dev');
  // A linter is optional in create-next-app, no typecheck or test script is
  // scaffolded, and Playwright is never assumed. None of these may be invented.
  for (const slot of ['lint', 'typecheck', 'test', 'integration_test'] as const) {
    assert.equal(resolved.commands[slot], undefined, `${slot} must not be invented`);
  }
});

test('a Next.js gate the profile cannot supply must be declared by the project', async t => {
  const root = await tree(t, { '.': ['package.json'] });
  const missing = await resolveProject(project('nextjs-react', {}, { tests: true }), { root, platform: 'posix' });
  assert.equal(missing.valid, false);
  if (!missing.valid) assert.ok(missing.issues.some(issue => issue.path === '/commands/test'));

  const declaredByProject = await resolvedOk(
    project('nextjs-react', { test: 'npm run test' }, { tests: true }),
    root,
  );
  assert.equal(declaredByProject.commands.test?.source, 'project');
});

test('supporting evidence is reported, and its absence is not a failure', async t => {
  const withConfig = await tree(t, { '.': ['package.json', 'next.config.ts'] });
  const found = await resolvedOk(project('nextjs-react', {}, { build: true }), withConfig);
  assert.deepEqual(found.evidence.found, ['next.config.ts']);
  assert.deepEqual(found.evidence.missing, ['next.config.js', 'next.config.mjs']);

  // A Next.js project is valid with no config file at all, so this still resolves.
  const bare = await tree(t, { '.': ['package.json'] });
  const none = await resolvedOk(project('nextjs-react', {}, { build: true }), bare);
  assert.deepEqual(none.evidence.found, []);
  assert.equal(none.evidence.missing.length, 3);
  assert.equal(none.commands.build?.command, 'npm run build');
});

test('a composed profile resolves each area with its own profile and runner', async t => {
  const root = await tree(t, {
    'backend': ['pom.xml', 'mvnw'],
    'frontend': ['package.json', 'next.config.ts'],
  });
  const resolved = await resolvedOk(
    project('fullstack', { build: 'make build', test: 'make test' }, { build: true, tests: true }),
    root,
  );

  // There is more than one build root, so there is no single one to report.
  assert.equal(resolved.buildSystem, undefined);
  assert.equal(resolved.runner, undefined);
  assert.deepEqual(resolved.areas.map(area => area.id), ['backend', 'frontend']);

  const [backend, frontend] = resolved.areas;
  assert.equal(backend?.profile.id, 'java-spring');
  assert.equal(backend?.buildSystem, 'maven');
  assert.deepEqual(backend?.runner, { command: './mvnw', availability: 'wrapper-present' });
  assert.deepEqual([...backend?.roles ?? []], ['backend-engineer', 'database-reviewer']);

  assert.equal(frontend?.profile.id, 'nextjs-react');
  assert.equal(frontend?.buildSystem, 'node');
  assert.deepEqual(frontend?.runner, { command: 'npm', availability: 'path-unverified' });
  assert.deepEqual(frontend?.evidence.found, ['next.config.ts']);

  // A composed profile supplies nothing, so every command came from the project.
  for (const command of Object.values(resolved.commands)) assert.equal(command.source, 'project');
});

test('a composed project must declare its own commands', async t => {
  const root = await tree(t, { 'backend': ['pom.xml'], 'frontend': ['package.json'] });
  const result = await resolveProject(project('fullstack', {}, { build: true }), { root, platform: 'posix' });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.issues.some(issue => issue.path === '/commands/build'));
});

test('a composed profile fails on a missing area and refuses a single build system', async t => {
  const partial = await tree(t, { 'backend': ['pom.xml'] });
  const missing = await resolveProject(
    project('fullstack', { build: 'make build' }, { build: true }),
    { root: partial, platform: 'posix' },
  );
  assert.equal(missing.valid, false);
  if (!missing.valid) {
    assert.equal(missing.issues[0]?.path, '/areas/frontend');
    assert.equal(missing.issues[0]?.code, 'area.missing');
  }

  const root = await tree(t, { 'backend': ['pom.xml'], 'frontend': ['package.json'] });
  const config = project('fullstack', { build: 'make build' }, { build: true });
  config.project.build_system = 'maven';
  const composed = await resolveProject(config, { root, platform: 'posix' });
  assert.equal(composed.valid, false);
  if (!composed.valid) assert.equal(composed.issues[0]?.code, 'buildsystem.not_composable');
});

test('an area with no build manifest fails rather than being assumed', async t => {
  const root = await tree(t, { 'backend': ['README.md'], 'frontend': ['package.json'] });
  const result = await resolveProject(
    project('fullstack', { build: 'make build' }, { build: true }),
    { root, platform: 'posix' },
  );
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.issues[0]?.path, '/areas/backend');
    assert.equal(result.issues[0]?.code, 'buildsystem.undetected');
  }
});

test('affected areas follow from changed paths, and roles follow from areas', async t => {
  const root = await tree(t, { 'backend': ['pom.xml'], 'frontend': ['package.json'] });
  const resolved = await resolvedOk(
    project('fullstack', { build: 'make build' }, { build: true }),
    root,
  );

  const backendOnly = analyzeImpact(resolved, ['backend/src/main/java/Order.java']);
  assert.deepEqual(backendOnly.areas.map(area => area.id), ['backend']);
  assert.deepEqual(backendOnly.roles, ['backend-engineer', 'database-reviewer']);
  assert.equal(backendOnly.crossesAreas, false);

  const frontendOnly = analyzeImpact(resolved, ['frontend/app/page.tsx']);
  assert.deepEqual(frontendOnly.areas.map(area => area.id), ['frontend']);
  assert.deepEqual(frontendOnly.roles, ['frontend-engineer']);

  const both = analyzeImpact(resolved, ['backend/src/Order.java', 'frontend/app/page.tsx']);
  assert.equal(both.crossesAreas, true);
  assert.deepEqual(both.roles, ['backend-engineer', 'database-reviewer', 'frontend-engineer']);

  // Repository-level files belong to no area and are surfaced, not dropped.
  const outside = analyzeImpact(resolved, ['README.md', 'backend/pom.xml']);
  assert.deepEqual(outside.unattributed, ['README.md']);
  assert.deepEqual(outside.areas.map(area => area.id), ['backend']);

  // Windows separators normalise, and a bare area directory counts as that area.
  assert.deepEqual(analyzeImpact(resolved, ['backend\\src\\Order.java']).areas.map(a => a.id), ['backend']);
  assert.deepEqual(analyzeImpact(resolved, ['./backend']).areas.map(a => a.id), ['backend']);
  assert.deepEqual(analyzeImpact(resolved, []).areas, []);
});

test('a single-area project has no areas, so nothing is attributed to one', async t => {
  const root = await tree(t, { '.': ['package.json'] });
  const resolved = await resolvedOk(project('nextjs-react', {}, { build: true }), root);
  const impact = analyzeImpact(resolved, ['app/page.tsx']);
  assert.deepEqual(impact.areas, []);
  assert.deepEqual(impact.roles, []);
  assert.deepEqual(impact.unattributed, ['app/page.tsx']);
  assert.equal(impact.crossesAreas, false);
});

test('every profile declares either build systems or areas, and composition is one level deep', () => {
  assert.deepEqual([...profileIds], ['fullstack', 'harness-tooling', 'java-spring', 'nextjs-react']);
  for (const id of profileIds) {
    const definition = profile(id);
    assert.notEqual(definition.buildSystems === undefined, definition.areas === undefined, id);
    assert.equal(isComposed(definition), definition.areas !== undefined);
    for (const area of definition.areas ?? []) {
      const areaProfile = profile(area.profile);
      assert.ok(areaProfile.buildSystems, `${id}/${area.id} must compose a profile with build systems`);
      assert.equal(areaProfile.areas, undefined, 'composition must not nest');
      for (const role of area.roles) assert.ok(agentIds.includes(role), `${id}/${area.id} role ${role}`);
    }
  }
});

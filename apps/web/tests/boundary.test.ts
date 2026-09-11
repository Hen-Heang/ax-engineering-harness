import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const roots = ['app', 'lib', 'components'];

/**
 * The harness package reaches the filesystem in its loader, resolver and detection
 * helpers. A client component that imports it — directly or through any local module
 * — drags `node:fs` into the browser bundle, which the bundler refuses to build.
 *
 * Scanning only for direct references misses that, because the offending import can
 * be two modules away. These tests follow local imports transitively instead.
 */
const harnessPackage = '@ax-harness/core';

async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...await sourceFiles(path));
    else if (/\.tsx?$/.test(item.name)) found.push(path);
  }
  return found;
}

/**
 * Drops type-only imports before scanning.
 *
 * TypeScript erases `import type` entirely, so it never reaches the bundle and
 * cannot pull a filesystem module into the browser. Treating it as a runtime import
 * would force types to be duplicated locally for no safety gain.
 */
function stripTypeImports(code: string): string {
  return code.replace(/import\s+type\s[\s\S]*?from\s*['"][^'"]+['"]/g, '');
}

function importsOf(code: string): string[] {
  const specifiers: string[] = [];
  for (const match of code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (match[1]) specifiers.push(match[1]);
  }
  return specifiers;
}

async function resolveLocal(fromFile: string, specifier: string): Promise<string | null> {
  let base: string;
  if (specifier.startsWith('@/')) base = join(webRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) base = join(dirname(fromFile), specifier);
  else return null;

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Not this candidate; try the next extension.
    }
  }
  return null;
}

async function allFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const root of roots) files.push(...await sourceFiles(join(webRoot, root)));
  return files;
}

/** Every local module reachable from a starting file, including itself. */
async function reachableFrom(entry: string): Promise<string[]> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    const code = await readFile(current, 'utf8');
    for (const specifier of importsOf(code)) {
      const resolved = await resolveLocal(current, specifier);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...seen];
}

test('at least one client component exists, so this check is not vacuous', async () => {
  const files = await allFiles();
  const clients: string[] = [];
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    if (/^\s*['"]use client['"]/.test(code)) clients.push(file);
  }
  assert.ok(clients.length > 0, 'expected client components to check');
});

test('no client component can reach the harness package, even through another module', async () => {
  const files = await allFiles();
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    if (!/^\s*['"]use client['"]/.test(code)) continue;

    for (const reached of await reachableFrom(file)) {
      const reachedCode = await readFile(reached, 'utf8');
      assert.equal(
        importsOf(stripTypeImports(reachedCode)).includes(harnessPackage),
        false,
        `client component ${relative(webRoot, file)} reaches ${harnessPackage} through ${relative(webRoot, reached)}`,
      );
    }
  }
});

test('the modules that do import the harness are server-only', async () => {
  const files = await allFiles();
  const importers: string[] = [];
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    if (importsOf(stripTypeImports(code)).includes(harnessPackage)) {
      importers.push(relative(webRoot, file).replaceAll('\\', '/'));
      assert.equal(/^\s*['"]use client['"]/.test(code), false, `${file} imports the harness and must not be a client module`);
    }
  }
  // Keeping this list short and known is the point: the fewer modules that touch the
  // harness, the smaller the surface that has to stay on the server.
  // lib/definitions.ts is deliberately absent: it takes only types from the harness,
  // which are erased, so its single runtime dependency is the catalog.
  assert.deepEqual(importers.sort(), ['lib/catalog.ts', 'lib/graph.ts']);
});

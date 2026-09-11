import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { compileFromFile } from 'json-schema-to-typescript';
import { fileURLToPath } from 'node:url';

const schemas = fileURLToPath(new URL('../schemas/', import.meta.url));

test('every JSON Schema has a matching generated TypeScript declaration', async () => {
  const entries = (await readdir(schemas)).filter(name => name.endsWith('.schema.json')).sort();
  assert.ok(entries.length > 0, 'no schemas found');
  for (const entry of entries) {
    const name = entry.replace('.schema.json', '');
    const expected = await compileFromFile(`${schemas}${entry}`);
    const actual = await readFile(new URL(`../config/${name}.generated.ts`, import.meta.url), 'utf8');
    assert.equal(actual.replaceAll('\r\n', '\n'), expected.replaceAll('\r\n', '\n'),
      `Run npm run generate:types --workspace @ax-harness/core (${name})`);
  }
});

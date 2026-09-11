import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileFromFile } from 'json-schema-to-typescript';
import { fileURLToPath } from 'node:url';

test('generated configuration types match the authoritative JSON Schema', async () => {
  for (const name of ['project', 'profile']) {
    const expected = await compileFromFile(fileURLToPath(new URL(`../schemas/${name}.schema.json`, import.meta.url)));
    const actual = await readFile(new URL(`../config/${name}.generated.ts`, import.meta.url), 'utf8');
    assert.equal(actual.replaceAll('\r\n', '\n'), expected.replaceAll('\r\n', '\n'),
      `Run npm run generate:types --workspace @ax-harness/core (${name})`);
  }
});

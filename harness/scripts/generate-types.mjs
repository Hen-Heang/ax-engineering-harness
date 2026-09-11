// Generates one TypeScript declaration per JSON Schema. Adding a schema needs no
// change here, and tests/schema-types.test.ts fails if a generated file drifts.
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileFromFile } from 'json-schema-to-typescript';

const schemas = fileURLToPath(new URL('../schemas/', import.meta.url));
const output = fileURLToPath(new URL('../config/', import.meta.url));

for (const entry of (await readdir(schemas)).filter(name => name.endsWith('.schema.json')).sort()) {
  const name = entry.replace('.schema.json', '');
  await writeFile(`${output}${name}.generated.ts`, await compileFromFile(`${schemas}${entry}`));
  console.log(`generated config/${name}.generated.ts`);
}

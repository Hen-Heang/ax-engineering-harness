import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { directoryExists, type BuildSystemId } from '../buildsystem/detect.js';

/**
 * Noticing what a project appears able to do but has not declared.
 *
 * A gate switched off in a declaration is ordinarily fine: not every project lints,
 * and nagging about a linter nobody wants would make the diagnostic worth ignoring.
 * A gate switched off in a project that plainly *can* run it is different. That is a
 * declaration which under-reports its own project, and reporting "nothing
 * outstanding" over it is the same error as calling an unrun gate a pass, one level
 * up: a clean report that describes less than the truth.
 *
 * Everything here is evidence, never proof. A `test` script exists; whether it passes
 * is a question only running it could answer, and this module runs nothing. Findings
 * are phrased so a person can judge the evidence rather than trust a verdict.
 */

/** Manifests are read whole, so the read is bounded. */
export const MAX_MANIFEST_BYTES = 1024 * 1024;

export interface CapabilityEvidence {
  /** Pipeline stage the evidence relates to. */
  stage: string;
  /** What was observed, in a form a person can check. */
  evidence: string;
}

/** Reads a manifest under a byte ceiling. Returns null when absent or too large. */
async function readManifest(path: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_MANIFEST_BYTES) return null;
    const buffer = Buffer.alloc(stat.size);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer.subarray(0, total));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/**
 * npm script names that answer for a stage, in preference order.
 *
 * A script existing is strong evidence: somebody wrote it down as something this
 * project does. It is still not proof that it succeeds.
 */
const NODE_SCRIPTS: { stage: string; names: string[] }[] = [
  { stage: 'build', names: ['build'] },
  { stage: 'lint', names: ['lint'] },
  { stage: 'typecheck', names: ['typecheck', 'type-check', 'tsc'] },
  { stage: 'unit_tests', names: ['test'] },
  { stage: 'integration_tests', names: ['e2e', 'test:e2e', 'integration', 'test:integration'] },
];

async function nodeEvidence(root: string): Promise<CapabilityEvidence[]> {
  const source = await readManifest(join(root, 'package.json'));
  if (source === null) return [];
  let scripts: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(source);
    if (parsed && typeof parsed === 'object' && 'scripts' in parsed) {
      const found = (parsed as { scripts?: unknown }).scripts;
      if (found && typeof found === 'object') scripts = found as Record<string, unknown>;
    }
  } catch {
    return [];
  }

  const evidence: CapabilityEvidence[] = [];
  for (const entry of NODE_SCRIPTS) {
    const name = entry.names.find(candidate => typeof scripts[candidate] === 'string');
    if (name) {
      evidence.push({ stage: entry.stage, evidence: `package.json declares a "${name}" script` });
    }
  }
  return evidence;
}

async function mavenEvidence(root: string): Promise<CapabilityEvidence[]> {
  const evidence: CapabilityEvidence[] = [];
  const pom = await readManifest(join(root, 'pom.xml'));
  if (pom?.includes('maven-failsafe-plugin')) {
    evidence.push({ stage: 'integration_tests', evidence: 'pom.xml configures maven-failsafe-plugin' });
  }
  if (await directoryExists(join(root, 'src', 'test'))) {
    evidence.push({ stage: 'unit_tests', evidence: 'src/test exists' });
  }
  return evidence;
}

async function gradleEvidence(root: string): Promise<CapabilityEvidence[]> {
  const evidence: CapabilityEvidence[] = [];
  if (await directoryExists(join(root, 'src', 'test'))) {
    evidence.push({ stage: 'unit_tests', evidence: 'src/test exists' });
  }
  if (await directoryExists(join(root, 'src', 'integrationTest'))) {
    evidence.push({ stage: 'integration_tests', evidence: 'src/integrationTest exists' });
  }
  return evidence;
}

/**
 * What this project looks able to run, from manifests and directory names only.
 *
 * Nothing is executed and no build file is interpreted; a manifest is read as text
 * and, for a package manifest, parsed as JSON to list script *names*.
 */
export async function detectCapabilities(
  root: string,
  buildSystem: BuildSystemId | undefined,
): Promise<CapabilityEvidence[]> {
  if (buildSystem === 'node') return nodeEvidence(root);
  if (buildSystem === 'maven') return mavenEvidence(root);
  if (buildSystem === 'gradle') return gradleEvidence(root);
  return [];
}

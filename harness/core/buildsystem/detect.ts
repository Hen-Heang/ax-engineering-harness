import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { BuildSystem, ProfileDefinition } from '../../config/profile.generated.js';
import type { ConfigIssue } from '../../config/validate.js';

export const buildSystemIds = ['maven', 'gradle', 'node'] as const;
export type BuildSystemId = (typeof buildSystemIds)[number];

export type Platform = 'posix' | 'windows';

/** Wrapper presence is evidence only; neither form is executed or probed for correctness. */
export type RunnerAvailability = 'wrapper-present' | 'path-unverified';

export interface ResolvedRunner {
  command: string;
  availability: RunnerAvailability;
}

export type BuildSystemSelection =
  | { ok: true; id: BuildSystemId; buildSystem: BuildSystem; runner: ResolvedRunner }
  | { ok: false; issues: ConfigIssue[] };

export function currentPlatform(): Platform {
  return process.platform === 'win32' ? 'windows' : 'posix';
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function declared(profile: ProfileDefinition, id: BuildSystemId): BuildSystem | undefined {
  return profile.buildSystems[id];
}

/**
 * Detects build systems by looking for manifests directly in the selected root.
 * Detection never recurses, so unrelated nested projects cannot influence the result.
 */
export async function detectBuildSystems(profile: ProfileDefinition, root: string): Promise<BuildSystemId[]> {
  const found: BuildSystemId[] = [];
  for (const id of buildSystemIds) {
    const buildSystem = declared(profile, id);
    if (!buildSystem) continue;
    for (const manifest of buildSystem.manifests) {
      if (await isFile(join(root, manifest))) {
        found.push(id);
        break;
      }
    }
  }
  return found;
}

/** Chooses the runner form for the platform. A missing wrapper falls back without verifying PATH. */
export async function resolveRunner(
  buildSystem: BuildSystem,
  root: string,
  platform: Platform,
): Promise<ResolvedRunner> {
  const wrapper = buildSystem.runner.wrapper?.[platform];
  if (wrapper && (await isFile(join(root, wrapper.file)))) {
    return { command: wrapper.command, availability: 'wrapper-present' };
  }
  return { command: buildSystem.runner.fallback, availability: 'path-unverified' };
}

/**
 * Resolves exactly one build system. Ambiguous evidence fails rather than choosing
 * arbitrarily; the project must then select one explicitly.
 */
export async function selectBuildSystem(
  profile: ProfileDefinition,
  root: string,
  explicit: BuildSystemId | undefined,
  platform: Platform,
): Promise<BuildSystemSelection> {
  const issue = (code: string, message: string): BuildSystemSelection => ({
    ok: false,
    issues: [{ path: explicit ? '/project/build_system' : '/project/profile', code, message }],
  });

  const detected = await detectBuildSystems(profile, root);

  let id: BuildSystemId;
  if (explicit) {
    if (!declared(profile, explicit)) {
      return issue('buildsystem.unsupported', 'The selected profile does not define this build system.');
    }
    if (!detected.includes(explicit)) {
      return issue('buildsystem.manifest_missing', 'No manifest for the selected build system exists in the project root.');
    }
    id = explicit;
  } else if (detected.length === 0) {
    return issue('buildsystem.undetected', 'No build manifest for this profile exists in the project root.');
  } else if (detected.length > 1) {
    return issue('buildsystem.ambiguous', 'Several build manifests are present. Set project.build_system to choose one.');
  } else {
    id = detected[0] as BuildSystemId;
  }

  const buildSystem = declared(profile, id) as BuildSystem;
  return { ok: true, id, buildSystem, runner: await resolveRunner(buildSystem, root, platform) };
}

import { join } from 'node:path';
import type { ProfileDefinition } from '../../config/profile.generated.js';
import type { ProjectConfig } from '../../config/project.generated.js';
import { validateDeclaration, validateProject, type ConfigIssue } from '../../config/validate.js';
import {
  checkEvidence,
  currentPlatform,
  directoryExists,
  selectBuildSystem,
  type BuildSystemId,
  type EvidenceReport,
  type Platform,
  type ResolvedRunner,
} from '../buildsystem/detect.js';
import { getProfile, profileIds } from './registry.js';

const commandSlots = ['build', 'lint', 'typecheck', 'test', 'integration_test', 'security'] as const;

export type CommandSource = 'project' | 'profile';

export interface ResolvedCommand {
  command: string;
  source: CommandSource;
}

/** One composed part of a repository, resolved by its own profile in its own directory. */
export interface ResolvedArea {
  id: string;
  title: string;
  path: string;
  profile: ProfileDefinition;
  buildSystem: BuildSystemId;
  runner: ResolvedRunner;
  roles: readonly string[];
  evidence: EvidenceReport;
}

export interface ResolvedProject {
  /** The declaration with profile defaults filled in. Only commands are derived. */
  config: ProjectConfig;
  profile: ProfileDefinition;
  /** Undefined for a composed profile, which has more than one build root. */
  buildSystem?: BuildSystemId;
  runner?: ResolvedRunner;
  evidence: EvidenceReport;
  /** Empty for a single-area profile. */
  areas: ResolvedArea[];
  commands: Partial<Record<(typeof commandSlots)[number], ResolvedCommand>>;
}

export type ResolutionResult =
  | { valid: true; resolved: ResolvedProject }
  | { valid: false; issues: ConfigIssue[] };

export interface ResolveOptions {
  /** Build root whose manifests are inspected. Never scanned recursively. */
  root: string;
  platform?: Platform;
}

function failure(path: string, code: string, message: string): ResolutionResult {
  return { valid: false, issues: [{ path, code, message }] };
}

/**
 * Resolves a declaration against its profile without executing anything.
 *
 * A project command always wins over a profile default, and a profile may only
 * contribute commands: permissions, quality gates, tools, context and limits are
 * carried over verbatim. The resolved configuration is re-validated in full, so a
 * profile can fill a missing command but can never mark an unsupplied gate as
 * satisfied or relax the policy the declaration already committed to.
 *
 * A composed profile resolves each of its areas in its own directory and supplies
 * no commands at all, so a composed project must declare its own.
 */
export async function resolveProject(input: unknown, options: ResolveOptions): Promise<ResolutionResult> {
  const declaration = validateDeclaration(input);
  if (!declaration.valid) return { valid: false, issues: declaration.issues };
  const declared = declaration.config;

  const profile = getProfile(declared.project.profile);
  if (!profile) {
    return failure('/project/profile', 'profile.unknown', `Unknown profile. This build resolves: ${profileIds.join(', ')}.`);
  }

  const platform = options.platform ?? currentPlatform();
  const commands: ResolvedProject['commands'] = {};
  const merged: Record<string, string> = {};

  for (const slot of commandSlots) {
    const declaredCommand = declared.commands[slot];
    if (declaredCommand) {
      merged[slot] = declaredCommand;
      commands[slot] = { command: declaredCommand, source: 'project' };
    }
  }

  let buildSystem: BuildSystemId | undefined;
  let runner: ResolvedRunner | undefined;
  const areas: ResolvedArea[] = [];

  if (profile.areas) {
    if (declared.project.build_system) {
      return failure('/project/build_system', 'buildsystem.not_composable',
        'A composed profile has more than one build root, so a single build system cannot be selected.');
    }
    for (const area of profile.areas) {
      const areaProfile = getProfile(area.profile);
      if (!areaProfile) {
        return failure(`/areas/${area.id}`, 'profile.unknown', 'The area names a profile this build cannot resolve.');
      }
      const areaRoot = join(options.root, ...area.path.split('/'));
      if (!(await directoryExists(areaRoot))) {
        return failure(`/areas/${area.id}`, 'area.missing', 'The directory this area declares does not exist.');
      }
      const selection = await selectBuildSystem(areaProfile, areaRoot, undefined, platform);
      if (!selection.ok) {
        return { valid: false, issues: selection.issues.map(issue => ({ ...issue, path: `/areas/${area.id}` })) };
      }
      areas.push({
        id: area.id,
        title: area.title,
        path: area.path,
        profile: areaProfile,
        buildSystem: selection.id,
        runner: selection.runner,
        roles: area.roles,
        evidence: await checkEvidence(areaProfile, areaRoot),
      });
    }
  } else {
    const selection = await selectBuildSystem(profile, options.root, declared.project.build_system, platform);
    if (!selection.ok) return { valid: false, issues: selection.issues };
    buildSystem = selection.id;
    runner = selection.runner;

    for (const slot of commandSlots) {
      if (merged[slot]) continue;
      const args = selection.buildSystem.commands[slot];
      if (!args) continue;
      const command = [selection.runner.command, ...args].join(' ');
      merged[slot] = command;
      commands[slot] = { command, source: 'profile' };
    }
  }

  const validated = validateProject({ ...declared, commands: merged });
  if (!validated.valid) return { valid: false, issues: validated.issues };

  return {
    valid: true,
    resolved: {
      config: validated.config,
      profile,
      ...(buildSystem ? { buildSystem } : {}),
      ...(runner ? { runner } : {}),
      evidence: await checkEvidence(profile, options.root),
      areas,
      commands,
    },
  };
}

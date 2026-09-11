import type { ProfileDefinition } from '../../config/profile.generated.js';
import type { ProjectConfig } from '../../config/project.generated.js';
import { validateDeclaration, validateProject, type ConfigIssue } from '../../config/validate.js';
import {
  currentPlatform,
  selectBuildSystem,
  type BuildSystemId,
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

export interface ResolvedProject {
  /** The declaration with profile defaults filled in. Only commands are derived. */
  config: ProjectConfig;
  profile: ProfileDefinition;
  buildSystem: BuildSystemId;
  runner: ResolvedRunner;
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

/**
 * Resolves a declaration against its profile without executing anything.
 *
 * A project command always wins over a profile default, and a profile may only
 * contribute commands: permissions, quality gates, tools, context and limits are
 * carried over verbatim. The resolved configuration is re-validated in full, so a
 * profile can fill a missing command but can never mark an unsupplied gate as
 * satisfied or relax the policy the declaration already committed to.
 */
export async function resolveProject(input: unknown, options: ResolveOptions): Promise<ResolutionResult> {
  const declaration = validateDeclaration(input);
  if (!declaration.valid) return { valid: false, issues: declaration.issues };
  const declared = declaration.config;

  const profile = getProfile(declared.project.profile);
  if (!profile) {
    return {
      valid: false,
      issues: [{
        path: '/project/profile',
        code: 'profile.unknown',
        message: `Unknown profile. This build resolves: ${profileIds.join(', ')}.`,
      }],
    };
  }

  const platform = options.platform ?? currentPlatform();
  const selection = await selectBuildSystem(profile, options.root, declared.project.build_system, platform);
  if (!selection.ok) return { valid: false, issues: selection.issues };

  const commands: ResolvedProject['commands'] = {};
  const merged: Record<string, string> = {};
  for (const slot of commandSlots) {
    const declaredCommand = declared.commands[slot];
    if (declaredCommand) {
      merged[slot] = declaredCommand;
      commands[slot] = { command: declaredCommand, source: 'project' };
      continue;
    }
    const args = selection.buildSystem.commands[slot];
    if (!args) continue;
    const command = [selection.runner.command, ...args].join(' ');
    merged[slot] = command;
    commands[slot] = { command, source: 'profile' };
  }

  const validated = validateProject({ ...declared, commands: merged });
  if (!validated.valid) return { valid: false, issues: validated.issues };

  return {
    valid: true,
    resolved: { config: validated.config, profile, buildSystem: selection.id, runner: selection.runner, commands },
  };
}

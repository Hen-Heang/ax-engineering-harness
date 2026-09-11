export { validateProject, validateDeclaration } from './config/validate.js';
export type { ValidationResult, ConfigIssue } from './config/validate.js';
export { parseProject, loadProject } from './config/load.js';
export { checkContextFiles } from './core/context/resolve.js';
export { getProfile, profileIds } from './core/profiles/registry.js';
export { resolveProject } from './core/profiles/resolve.js';
export type {
  CommandSource, ResolutionResult, ResolvedCommand, ResolvedProject, ResolveOptions,
} from './core/profiles/resolve.js';
export { buildSystemIds, currentPlatform, detectBuildSystems, selectBuildSystem } from './core/buildsystem/detect.js';
export type {
  BuildSystemId, BuildSystemSelection, Platform, ResolvedRunner, RunnerAvailability,
} from './core/buildsystem/detect.js';
export type { ProjectConfig } from './config/project.generated.js';
export type { ProfileDefinition } from './config/profile.generated.js';

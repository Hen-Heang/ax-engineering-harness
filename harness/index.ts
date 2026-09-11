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
export {
  adapterIds, agentIds, consistencyErrors, getAdapter, getAgent, getSkill, skillIds,
} from './core/agents/registry.js';
export {
  capabilityIds, deniedCapabilityIds, getCapability, policy, requiresHumanApproval,
} from './core/permissions/policy.js';
export type { Capability } from './core/permissions/policy.js';
export { can, capabilityMatrix, requiredTools } from './core/permissions/decide.js';
export type { MatrixRow } from './core/permissions/decide.js';
export type { ProjectConfig } from './config/project.generated.js';
export type { ProfileDefinition } from './config/profile.generated.js';
export type { AgentDefinition } from './config/agent.generated.js';
export type { SkillDefinition } from './config/skill.generated.js';
export type { AdapterDefinition } from './config/adapter.generated.js';
export type { PolicyDefinition } from './config/policy.generated.js';

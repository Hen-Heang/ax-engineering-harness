export { validateProject, validateDeclaration } from './config/validate.js';
export type { ValidationResult, ConfigIssue } from './config/validate.js';
export { parseProject, loadProject } from './config/load.js';
export { checkContextFiles } from './core/context/resolve.js';
export { getProfile, isComposed, profileIds } from './core/profiles/registry.js';
export { analyzeImpact } from './core/profiles/areas.js';
export type { AreaImpact } from './core/profiles/areas.js';
export { resolveProject } from './core/profiles/resolve.js';
export type {
  CommandSource, ResolutionResult, ResolvedArea, ResolvedCommand, ResolvedProject, ResolveOptions,
} from './core/profiles/resolve.js';
export { buildSystemIds, checkEvidence, currentPlatform, detectBuildSystems, directoryExists, selectBuildSystem } from './core/buildsystem/detect.js';
export type {
  BuildSystemId, BuildSystemSelection, EvidenceReport, Platform, ResolvedRunner, RunnerAvailability,
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
export { authorize, CLI_CAPABILITIES, isAllowed, toolEnabled } from './core/permissions/authorize.js';
export type {
  Actor, AuthorizationDecision, AuthorizationOutcome, AuthorizationRequest, DenialReason,
  HumanApproval,
} from './core/permissions/authorize.js';
export type { ProjectConfig } from './config/project.generated.js';
export type { ProfileDefinition } from './config/profile.generated.js';
export type { AgentDefinition } from './config/agent.generated.js';
export type { SkillDefinition } from './config/skill.generated.js';
export type { AdapterDefinition } from './config/adapter.generated.js';
export type { PolicyDefinition } from './config/policy.generated.js';
export {
  initialStatuses, pipeline, pipelinePassed, planQuality, summarize,
} from './core/quality/plan.js';
export type { GateOutcome, GatePlan, GateReadiness, GateStatus, Stage } from './core/quality/plan.js';
export { EXECUTION_CAPABILITY, executeQualityPlan, mayExecute } from './core/quality/execute.js';
export type {
  ExecuteQualityPlanOptions, QualityActor, QualityCommandRunner, QualityExecutionResult,
  QualityFinalStatus, QualityGateOutcome, QualityGateReason, QualityGateResult,
} from './core/quality/execute.js';
export {
  canRetry, canTransition, checkTransition, getState, isFailurePath, workflow, workflowStateIds,
} from './core/workflow/lifecycle.js';
export type { TransitionCheck, WorkflowState } from './core/workflow/lifecycle.js';
export { evalIds, getEval, scoreEval } from './core/evals/registry.js';
export type { EvalScore } from './core/evals/registry.js';
export { buildRunRecord, createRunId, getRun, isMeasured, runIds, validateRunRecord } from './core/observability/run.js';
export type { RunRecordInputs, RunValidation } from './core/observability/run.js';
export { loadRunRecord, MAX_RUN_RECORD_BYTES, persistRunRecord } from './core/observability/storage.js';
export type { LoadRunResult, PersistRunResult } from './core/observability/storage.js';
export { checkHandoffDocument, requiredHandoffSections, validateHandoffRecord } from './core/handoff/check.js';
export type { HandoffValidation } from './core/handoff/check.js';
export type { PipelineDefinition } from './config/pipeline.generated.js';
export type { WorkflowDefinition } from './config/workflow.generated.js';
export type { EvalDefinition } from './config/eval.generated.js';
export type { RunRecord } from './config/run.generated.js';
export type { HandoffRecord } from './config/handoff.generated.js';
export { architecture, architectureErrors, getArchitectureNode } from './core/architecture/registry.js';
export type { ArchitectureEdge, ArchitectureNode } from './core/architecture/registry.js';
export type { ArchitectureDefinition } from './config/architecture.generated.js';
export { resolveExecutable, toArgv } from './core/execution/executable.js';
export type { ArgvResult, ArgvRefusal } from './core/execution/executable.js';
export { buildBatchCommandLine, DEFAULT_MAX_OUTPUT_BYTES, parseCommand, runCommand } from './core/execution/index.js';
export type {
  CommandExecutionResult, CommandExecutionStatus, CommandLauncher, CommandParseResult,
  CommandRunnerOptions, ParsedCommand, UnsupportedCommandReason,
} from './core/execution/index.js';

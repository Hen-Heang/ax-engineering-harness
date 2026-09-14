import type { ProjectConfig } from '../../config/project.generated.js';
import { getAgent } from '../agents/registry.js';
import { getCapability, type Capability } from './policy.js';

/**
 * Deciding whether an actor may use a capability in a project.
 *
 * This is the deterministic core the rest of the harness asks before doing anything
 * on someone's behalf. It is a pure function of the request, the built-in policy,
 * and the project declaration: no ambient state, no configuration read from disk, no
 * environment, and nothing that varies between two identical calls.
 *
 * The governing rule is that anything not explicitly allowed is denied. There is no
 * branch anywhere below that treats an unrecognised role, an unrecognised capability,
 * or an unrecognised actor as permitted.
 *
 * A decision is still not enforcement. Every caller must act on the answer; a tool
 * layer that consults nothing is unaffected by anything here.
 */

/** Who is asking. A person at the CLI is not an agent, and is not modelled as one. */
export type Actor =
  | { kind: 'human-cli' }
  | { kind: 'agent'; role: string };

export type AuthorizationOutcome = 'allowed' | 'denied' | 'requires-approval';

export type DenialReason =
  /** No such capability in the policy vocabulary. */
  | 'unknown-capability'
  /** No such role in the agent registry. */
  | 'unknown-role'
  /** The actor's definition does not list this capability. */
  | 'actor-lacks-capability'
  /** The policy denies this capability to every agent, whatever a role claims. */
  | 'denied-to-all-agents'
  /** The project declaration forbids it, independently of the policy. */
  | 'project-forbids'
  /** The capability needs a tool the project has switched off. */
  | 'tool-disabled';

export interface HumanApproval {
  /** The capability this approval was granted for. An approval is not transferable. */
  capability: string;
  /** Who granted it. Recorded so a decision can be traced back to a person. */
  grantedBy: string;
  /** When, as an ISO 8601 instant. */
  grantedAt: string;
}

export interface AuthorizationRequest {
  actor: Actor;
  capability: string;
  project: ProjectConfig;
  /**
   * Explicit, per-request approval. Deliberately part of the request rather than
   * global state, so no caller can approve something by leaving a flag set
   * somewhere else, and so a decision can be reproduced from its inputs alone.
   */
  approval?: HumanApproval;
}

export type AuthorizationDecision =
  | { outcome: 'allowed'; capability: Capability }
  | { outcome: 'requires-approval'; capability: Capability }
  | { outcome: 'denied'; reason: DenialReason; capability?: Capability };

/**
 * The capabilities the CLI itself exercises on a person's behalf.
 *
 * This is a statement of what the tool does, not a grant of trust. Running
 * `ax validate` reads the declaration and its context; running
 * `ax quality --execute` runs the declared commands. The CLI does nothing else for
 * anyone, so nothing else is authorised for it, and a person who wants to push a
 * branch still does that themselves with git.
 */
export const CLI_CAPABILITIES: readonly string[] = ['read_code', 'read_docs', 'run_tests'];

/**
 * Capabilities a project declaration can forbid outright, named identically in
 * `.ax/project.yaml` and in the policy. The schema currently pins each to false, so
 * today this always denies; it is checked rather than assumed because the project is
 * a separate source of authority from the built-in policy.
 */
const PROJECT_FORBIDDABLE = [
  'direct_main_push', 'force_push', 'production_deploy', 'database_write', 'secrets_access',
] as const;

type ForbiddableCapability = typeof PROJECT_FORBIDDABLE[number];

function isForbiddable(id: string): id is ForbiddableCapability {
  return (PROJECT_FORBIDDABLE as readonly string[]).includes(id);
}

/** Whether the project has switched on the tool a capability depends on. */
export function toolEnabled(project: ProjectConfig, tool: Capability['tool']): boolean {
  return tool === 'none' ? true : project.tools[tool].enabled;
}

/** Whether the actor's own definition lists the capability. Unknown actors list none. */
function actorHolds(actor: Actor, capability: string): { known: boolean; holds: boolean } {
  if (actor.kind === 'human-cli') return { known: true, holds: CLI_CAPABILITIES.includes(capability) };
  const agent = getAgent(actor.role);
  if (!agent) return { known: false, holds: false };
  return { known: true, holds: agent.capabilities.includes(capability) };
}

/**
 * Whether an approval actually covers this request.
 *
 * An approval names the capability it was granted for, so one granted for a comment
 * cannot be replayed against a pull request. It must also name a person and a real
 * instant, because an approval nobody can be traced to is not an approval.
 */
function approvalCovers(approval: HumanApproval | undefined, capability: string): boolean {
  if (!approval) return false;
  if (approval.capability !== capability) return false;
  if (approval.grantedBy.trim().length === 0) return false;
  return Number.isFinite(Date.parse(approval.grantedAt));
}

/**
 * Answers whether an actor may use a capability in a project.
 *
 * Checks run from the most fundamental denial outwards, so the reason returned is
 * the one that would still apply if every later condition were satisfied.
 */
export function authorize(request: AuthorizationRequest): AuthorizationDecision {
  const capability = getCapability(request.capability);
  if (!capability) return { outcome: 'denied', reason: 'unknown-capability' };

  // Denied to every agent by the policy. No role, project, or approval lifts this.
  if (capability.deniedToAllAgents) {
    return { outcome: 'denied', reason: 'denied-to-all-agents', capability };
  }

  // The project is a separate authority from the policy, and may also refuse.
  if (isForbiddable(capability.id) && request.project.permissions[capability.id] === false) {
    return { outcome: 'denied', reason: 'project-forbids', capability };
  }

  const held = actorHolds(request.actor, capability.id);
  if (!held.known) return { outcome: 'denied', reason: 'unknown-role', capability };
  if (!held.holds) return { outcome: 'denied', reason: 'actor-lacks-capability', capability };

  // Holding a capability does not switch on the tool it needs. The project decides
  // which tools exist at all, and a role cannot overrule that.
  if (!toolEnabled(request.project, capability.tool)) {
    return { outcome: 'denied', reason: 'tool-disabled', capability };
  }

  /*
   * Approval is the last step, and it only ever converts `requires-approval` into
   * `allowed`. It cannot lift any denial above, so approving a request does not
   * become a way to reach a capability the policy, the project, or the role refuses.
   */
  if (capability.humanApproval && !approvalCovers(request.approval, capability.id)) {
    return { outcome: 'requires-approval', capability };
  }

  return { outcome: 'allowed', capability };
}

/** Convenience for call sites that only need to proceed or not. */
export function isAllowed(decision: AuthorizationDecision): boolean {
  return decision.outcome === 'allowed';
}

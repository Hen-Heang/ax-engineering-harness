import { agentIds, getAgent } from '../agents/registry.js';
import { getCapability, policy, type Capability } from './policy.js';

export interface MatrixRow {
  capability: Capability;
  /** Agent identifiers whose definition grants this capability. Empty when denied. */
  agents: string[];
}

/**
 * Answers what the definitions say, and nothing more.
 *
 * A true result means the role is permitted to use the capability, not that access is
 * available, configured, or enforced. Enforcement belongs to a tool layer that does
 * not exist yet, so this must never be treated as a security boundary.
 */
export function can(agentId: string, capability: string): boolean {
  const agent = getAgent(agentId);
  if (!agent || !getCapability(capability)) return false;
  return agent.capabilities.includes(capability);
}

/** The full capability matrix, ordered as the policy declares it. */
export function capabilityMatrix(): MatrixRow[] {
  return policy.capabilities.map(capability => ({
    capability,
    agents: agentIds.filter(id => can(id, capability.id)),
  }));
}

/**
 * Project tool switches that must be enabled for a role to work as defined.
 * Capabilities that depend on no tool contribute nothing.
 */
export function requiredTools(agentId: string): string[] {
  const agent = getAgent(agentId);
  if (!agent) return [];
  const tools = new Set<string>();
  for (const id of agent.capabilities) {
    const capability = getCapability(id);
    if (capability && capability.tool !== 'none') tools.add(capability.tool);
  }
  return [...tools].sort();
}

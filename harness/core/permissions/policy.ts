import { Ajv } from 'ajv';
import schema from '../../schemas/policy.schema.json' with { type: 'json' };
import defaultPolicy from '../../policies/default/policy.json' with { type: 'json' };
import type { PolicyDefinition } from '../../config/policy.generated.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<PolicyDefinition>(schema);

function load(source: unknown): PolicyDefinition {
  if (!validateSchema(source)) {
    throw new Error('The built-in policy does not satisfy the policy schema.');
  }
  return source;
}

/**
 * The capability vocabulary every agent and skill is written against.
 *
 * This is a declaration, not an enforcement point. Asking whether a capability is
 * allowed tells you what the definitions say; it does not grant access, open a
 * connection, or constrain a tool at runtime. No such runtime exists yet.
 */
export const policy: PolicyDefinition = load(defaultPolicy);

export type Capability = PolicyDefinition['capabilities'][number];

const byId = new Map<string, Capability>(policy.capabilities.map(capability => [capability.id, capability]));
if (byId.size !== policy.capabilities.length) {
  throw new Error('The built-in policy declares a duplicate capability identifier.');
}

export const capabilityIds: readonly string[] = [...byId.keys()];

/** Capabilities no agent definition may claim, regardless of role. */
export const deniedCapabilityIds: readonly string[] = policy.capabilities
  .filter(capability => capability.deniedToAllAgents)
  .map(capability => capability.id);

export function getCapability(id: string): Capability | undefined {
  return byId.get(id);
}

/** High-impact capabilities that need explicit human approval before use. */
export function requiresHumanApproval(id: string): boolean {
  return byId.get(id)?.humanApproval === true;
}

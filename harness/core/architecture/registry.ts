import { Ajv } from 'ajv';
import schema from '../../schemas/architecture.schema.json' with { type: 'json' };
import defaultArchitecture from '../../architecture/default/architecture.json' with { type: 'json' };
import type { ArchitectureDefinition } from '../../config/architecture.generated.js';
import { getAdapter, getAgent, getSkill } from '../agents/registry.js';
import { getCapability } from '../permissions/policy.js';
import { getProfile } from '../profiles/registry.js';
import { getEval } from '../evals/registry.js';
import { getRun } from '../observability/run.js';
import { pipeline } from '../quality/plan.js';
import { policy } from '../permissions/policy.js';
import { workflow } from '../workflow/lifecycle.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<ArchitectureDefinition>(schema);

export type ArchitectureNode = ArchitectureDefinition['nodes'][number];
export type ArchitectureEdge = ArchitectureDefinition['edges'][number];

/** Resolves a node's reference to prove the definition it points at exists. */
function referenceExists(kind: string, id: string): boolean {
  switch (kind) {
    case 'profile': return getProfile(id) !== undefined;
    case 'agent': return getAgent(id) !== undefined;
    case 'skill': return getSkill(id) !== undefined;
    case 'adapter': return getAdapter(id) !== undefined;
    case 'eval': return getEval(id) !== undefined;
    case 'run': return getRun(id) !== undefined;
    case 'policy': return policy.id === id;
    case 'pipeline': return pipeline.id === id;
    case 'workflow': return workflow.id === id;
    default: return false;
  }
}

/**
 * Cross-definition invariants for the architecture map.
 *
 * Exported as a pure function so the guard is tested rather than assumed, and run at
 * module load so a map that describes something the harness does not define fails
 * immediately instead of being rendered.
 */
export function architectureErrors(definition: ArchitectureDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const node of definition.nodes) {
    if (ids.has(node.id)) errors.push(`Architecture declares node "${node.id}" more than once.`);
    ids.add(node.id);

    for (const agent of node.agents ?? []) {
      if (!getAgent(agent)) errors.push(`Node "${node.id}" names unknown role "${agent}".`);
    }
    for (const skill of node.skills ?? []) {
      if (!getSkill(skill)) errors.push(`Node "${node.id}" names unknown skill "${skill}".`);
    }
    for (const capability of node.capabilities ?? []) {
      if (!getCapability(capability)) errors.push(`Node "${node.id}" names unknown capability "${capability}".`);
    }
    if (node.reference && !referenceExists(node.reference.kind, node.reference.id)) {
      errors.push(`Node "${node.id}" references missing ${node.reference.kind} "${node.reference.id}".`);
    }
  }

  for (const edge of definition.edges) {
    if (!ids.has(edge.from)) errors.push(`Edge from unknown node "${edge.from}".`);
    if (!ids.has(edge.to)) errors.push(`Edge to unknown node "${edge.to}".`);
    if (edge.from === edge.to) errors.push(`Edge on "${edge.from}" points at itself.`);
  }

  const connected = new Set(definition.edges.flatMap(edge => [edge.from, edge.to]));
  for (const node of definition.nodes) {
    if (!connected.has(node.id)) errors.push(`Node "${node.id}" is not connected to anything.`);
  }

  return errors;
}

function load(source: unknown): ArchitectureDefinition {
  if (!validateSchema(source)) {
    throw new Error('The built-in architecture does not satisfy the architecture schema.');
  }
  const errors = architectureErrors(source);
  if (errors.length) throw new Error(errors[0]);
  return source;
}

/**
 * The architecture map.
 *
 * It describes how the parts relate. It does not run anything, and a node that
 * names a role does not start one.
 */
export const architecture: ArchitectureDefinition = load(defaultArchitecture);

export function getArchitectureNode(id: string): ArchitectureNode | undefined {
  return architecture.nodes.find(node => node.id === id);
}

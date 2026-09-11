import { Ajv } from 'ajv';
import schema from '../../schemas/workflow.schema.json' with { type: 'json' };
import defaultLifecycle from '../../workflow/default/lifecycle.json' with { type: 'json' };
import type { WorkflowDefinition } from '../../config/workflow.generated.js';
import { agentIds } from '../agents/registry.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<WorkflowDefinition>(schema);

export type WorkflowState = WorkflowDefinition['states'][number];

function load(source: unknown): WorkflowDefinition {
  if (!validateSchema(source)) throw new Error('The built-in workflow does not satisfy the workflow schema.');
  const ids = new Set(source.states.map(state => state.id));
  if (ids.size !== source.states.length) throw new Error('The workflow declares a duplicate state identifier.');
  if (!ids.has(source.initial)) throw new Error('The workflow initial state is not declared.');
  for (const state of source.states) {
    for (const target of [...state.next, ...(state.onFailure ? [state.onFailure] : [])]) {
      if (!ids.has(target)) throw new Error(`Workflow state "${state.id}" targets unknown state "${target}".`);
    }
    for (const agent of state.agents) {
      if (!agentIds.includes(agent)) throw new Error(`Workflow state "${state.id}" names unknown role "${agent}".`);
    }
  }
  return source;
}

/**
 * The generic engineering lifecycle.
 *
 * This describes permitted transitions. Nothing advances a state, because no runner
 * exists; asking whether a transition is allowed is a question about the definition.
 */
export const workflow: WorkflowDefinition = load(defaultLifecycle);

const byId = new Map<string, WorkflowState>(workflow.states.map(state => [state.id, state]));

export const workflowStateIds: readonly string[] = [...byId.keys()];

export function getState(id: string): WorkflowState | undefined {
  return byId.get(id);
}

/** A failure path returns to the state that can actually fix the problem. */
export function isFailurePath(from: string, to: string): boolean {
  return byId.get(from)?.onFailure === to;
}

export function canTransition(from: string, to: string): boolean {
  const state = byId.get(from);
  if (!state || !byId.has(to)) return false;
  // The generated type is a union of fixed-length tuples, so widen before searching.
  const next: readonly string[] = state.next;
  return next.includes(to) || state.onFailure === to;
}

/** Retries are bounded by the project's declared `limits.max_retries`. */
export function canRetry(retriesUsed: number, maxRetries: number): boolean {
  return retriesUsed < maxRetries;
}

export interface TransitionCheck {
  allowed: boolean;
  retry: boolean;
  reason?: string;
}

/**
 * Combines the transition rule with the retry budget, so that a failure path cannot
 * be taken indefinitely. Exhausting the budget is a stop, not a silent loop.
 */
export function checkTransition(
  from: string,
  to: string,
  retriesUsed: number,
  maxRetries: number,
): TransitionCheck {
  if (!canTransition(from, to)) {
    return { allowed: false, retry: false, reason: 'The lifecycle does not permit this transition.' };
  }
  const retry = isFailurePath(from, to);
  if (retry && !canRetry(retriesUsed, maxRetries)) {
    return { allowed: false, retry: true, reason: 'The declared retry limit is exhausted.' };
  }
  return { allowed: true, retry };
}

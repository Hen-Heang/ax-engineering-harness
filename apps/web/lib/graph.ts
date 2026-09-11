import { architecture, workflow } from '@ax-harness/core';
import { findEntry } from './catalog';
import type { Graph, GraphSection } from './graph-types';

/**
 * Builds the console's two diagrams from harness definitions.
 *
 * Both come from the architecture map and the lifecycle rather than being drawn by
 * hand here, so a diagram cannot show a part or a transition the harness does not
 * declare.
 *
 * This module imports the harness and therefore runs on the server only. The shapes
 * and pure helpers live in `graph-types.ts`, which a client component may import;
 * the finished graph reaches the browser as serialized props.
 */

function section(label: string, items: readonly string[] | undefined): GraphSection[] {
  return items && items.length > 0 ? [{ label, items: [...items] }] : [];
}

function sourceFor(reference: { kind: string; id: string } | null): string | null {
  if (!reference) return null;
  return findEntry(reference.kind, reference.id)?.source ?? null;
}

export const architectureGraph: Graph = {
  nodes: architecture.nodes.map(node => {
    const reference = node.reference ? { kind: node.reference.kind, id: node.reference.id } : null;
    return {
      id: node.id,
      title: node.title,
      kind: node.kind,
      row: node.row,
      column: node.column,
      summary: node.summary,
      why: node.why,
      sections: [
        ...section('Responsibilities', node.responsibilities),
        ...section('Inputs', node.inputs),
        ...section('Outputs', node.outputs),
        ...section('Roles', node.agents),
        ...section('Skills', node.skills),
        ...section('Capabilities', node.capabilities),
      ],
      reference,
      source: sourceFor(reference),
    };
  }),
  edges: architecture.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`,
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    label: edge.label ?? null,
  })),
};

const workflowReference = { kind: 'workflow', id: workflow.id };

export const workflowGraph: Graph = {
  nodes: workflow.states.map((state, index) => ({
    id: state.id,
    title: state.title,
    kind: state.agents.length > 0 ? 'agent' : 'core',
    row: index,
    column: 0,
    summary: state.description,
    why: null,
    sections: [
      ...section('Owned by', state.agents.length > 0
        ? state.agents
        : ['A person, or a capability that does not exist yet']),
      ...section('Permitted next', state.next.length > 0 ? state.next : ['Terminal for one task']),
      ...section('On failure', state.onFailure
        ? [`Returns to ${state.onFailure}`]
        : ['No failure path declared']),
    ],
    reference: workflowReference,
    source: sourceFor(workflowReference),
  })),
  edges: [
    ...workflow.states.flatMap(state =>
      state.next.map((target: string) => ({
        id: `${state.id}-${target}`,
        from: state.id,
        to: target,
        kind: 'flow' as const,
        label: null,
      })),
    ),
    ...workflow.states
      .filter(state => state.onFailure !== undefined)
      .map(state => ({
        id: `${state.id}-fail-${state.onFailure}`,
        from: state.id,
        to: state.onFailure as string,
        kind: 'failure' as const,
        label: 'on failure',
      })),
  ],
};

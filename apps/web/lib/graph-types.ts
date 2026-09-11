/**
 * Graph shapes and pure helpers, with no harness import.
 *
 * This module exists so client components can describe graph data without pulling in
 * `@ax-harness/core`. That package reaches the filesystem in its loader, resolver and
 * detection helpers, so importing it from a client component would drag `node:fs`
 * into the browser bundle. Building a graph belongs in `lib/graph.ts`, which runs on
 * the server; a client component receives the finished, serializable result.
 */

export type EdgeKind = 'flow' | 'failure' | 'feedback';

export interface GraphSection {
  label: string;
  items: string[];
}

export interface GraphNode {
  id: string;
  title: string;
  kind: string;
  row: number;
  column: number;
  summary: string;
  why: string | null;
  sections: GraphSection[];
  /** The definition a reader can inspect for this node, when one applies. */
  reference: { kind: string; id: string } | null;
  /** That definition's real source, rendered from the loaded object. */
  source: string | null;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Sorts a graph's nodes into the rows a renderer lays out. */
export function rowsOf(graph: Graph): GraphNode[][] {
  const rows = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) {
    const row = rows.get(node.row) ?? [];
    row.push(node);
    rows.set(node.row, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, nodes]) => nodes.sort((a, b) => a.column - b.column));
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, Controls, Handle, Position, ReactFlow,
  type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { rowsOf, type Graph, type GraphNode } from '@/lib/graph-types';

const COLUMN_WIDTH = 215;
const ROW_HEIGHT = 104;
// React Flow needs node dimensions before it can fit the view. Without them it
// measures an empty box on first paint and zooms all the way in.
const NODE_WIDTH = 175;
const NODE_HEIGHT = 58;

/**
 * How far the view may zoom out to fit.
 *
 * These graphs are tall and narrow — the architecture map is twelve rows deep and at
 * most three wide — while the canvas is short and wide, so fitting one needs a good
 * deal of zooming out. The previous floor of 0.75 was above what fitting required,
 * which meant the first paint showed a cropped graph and left the reader panning to
 * discover the rest. Fitting on arrival matters more than node text being
 * comfortable, because a reader who cannot see the shape does not know what to pan
 * towards; Expand then gives back the readability this costs.
 */
const FIT_MIN_ZOOM = 0.45;
const FIT_OPTIONS = { padding: 0.12, minZoom: FIT_MIN_ZOOM, maxZoom: 1 } as const;

const kindStyles: Record<string, string> = {
  actor: 'border-foreground/40',
  artifact: 'border-border',
  core: 'border-primary/50',
  agent: 'border-primary/40',
  tools: 'border-border',
  quality: 'border-border',
  review: 'border-foreground/40',
};

const edgeStyles: Record<string, { stroke: string; dash?: string }> = {
  flow: { stroke: 'var(--color-muted-foreground)' },
  failure: { stroke: 'var(--color-destructive)', dash: '5 4' },
  feedback: { stroke: 'var(--color-muted-foreground)', dash: '2 4' },
};

type FlowNodeData = { node: GraphNode; selected: boolean };

function DiagramNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const { node, selected } = data;
  return (
    <div
      className={cn(
        'h-full w-full rounded-md border bg-card px-3 py-2 text-left shadow-sm',
        kindStyles[node.kind] ?? 'border-border',
        selected && 'ring-2 ring-ring',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-muted-foreground" />
      <p className="text-sm leading-tight font-medium">{node.title}</p>
      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground capitalize">{node.kind}</p>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { diagram: DiagramNode };

/** The canvas itself, so the page and the expanded overlay render the same thing. */
function Canvas({
  nodes, edges, colorMode, onSelect, onReady,
}: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  colorMode: 'light' | 'dark';
  onSelect: (id: string) => void;
  onReady: (instance: ReactFlowInstance<Node<FlowNodeData>, Edge>) => void;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={FIT_OPTIONS}
      minZoom={0.3}
      maxZoom={1.6}
      colorMode={colorMode}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      deleteKeyCode={null}
      connectOnClick={false}
      onInit={onReady}
      onNodeClick={(_event, node) => onSelect(node.id)}
      proOptions={{ hideAttribution: false }}
    >
      <Background gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

/**
 * A read-only visualization of a harness graph.
 *
 * Nodes cannot be dragged, connected or deleted: this shows a definition, it does
 * not edit one. Everything the diagram conveys is repeated in the list beneath it,
 * so the content does not depend on the canvas being usable.
 */
export function GraphView({ graph, label }: { graph: Graph; label: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const [expanded, setExpanded] = useState(false);
  const inline = useRef<ReactFlowInstance<Node<FlowNodeData>, Edge> | null>(null);
  const overlay = useRef<ReactFlowInstance<Node<FlowNodeData>, Edge> | null>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // React Flow's own "system" detection resolved to light on a dark page, so the
  // diagram follows the same class the rest of the console is themed by.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setColorMode(root.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /*
   * While the overlay is open it owns the viewport: the page behind must not scroll,
   * Escape must close, and focus belongs to the overlay rather than to whatever the
   * reader last touched underneath it.
   */
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const close = useCallback(() => {
    setExpanded(false);
    expandButton.current?.focus();
  }, []);

  const positions = useMemo(() => {
    const placed = new Map<string, { x: number; y: number }>();
    for (const row of rowsOf(graph)) {
      row.forEach((node, index) => {
        placed.set(node.id, {
          x: (index - (row.length - 1) / 2) * COLUMN_WIDTH,
          y: node.row * ROW_HEIGHT,
        });
      });
    }
    return placed;
  }, [graph]);

  const nodes: Node<FlowNodeData>[] = useMemo(
    () => graph.nodes.map(node => ({
      id: node.id,
      type: 'diagram',
      position: positions.get(node.id) ?? { x: 0, y: node.row * ROW_HEIGHT },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: { node, selected: node.id === selectedId },
    })),
    [graph, positions, selectedId],
  );

  const edges: Edge[] = useMemo(
    () => graph.edges.map(edge => {
      const style = edgeStyles[edge.kind] ?? edgeStyles.flow;
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        animated: false,
        label: edge.label ?? undefined,
        style: { stroke: style?.stroke, strokeDasharray: style?.dash, strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: 'var(--color-muted-foreground)' },
        labelBgStyle: { fill: 'var(--color-background)' },
      };
    }),
    [graph],
  );

  const selected = graph.nodes.find(node => node.id === selectedId) ?? null;
  const select = useCallback((id: string) => setSelectedId(current => (current === id ? null : id)), []);

  /** Fits the whole graph, whichever canvas the reader is looking at. */
  const fit = useCallback(() => {
    const instance = expanded ? overlay.current : inline.current;
    void instance?.fitView({ ...FIT_OPTIONS, duration: 200 });
  }, [expanded]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Drag to pan, scroll to zoom, select a node for its detail. The diagram is read-only.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fit}>
              Fit to view
            </Button>
            <Button
              ref={expandButton}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(true)}
              aria-haspopup="dialog"
            >
              Expand
            </Button>
          </div>
        </div>

        <div
          className="h-[32rem] w-full overflow-hidden rounded-lg border bg-card sm:h-[40rem] lg:h-[46rem]"
          aria-label={`${label}. An equivalent list follows this diagram.`}
          role="group"
        >
          <Canvas
            nodes={nodes}
            edges={edges}
            colorMode={colorMode}
            onSelect={select}
            onReady={instance => { inline.current = instance; }}
          />
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label={`${label}, expanded`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
            <p className="truncate text-sm font-medium">{label}</p>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fit}>
                Fit to view
              </Button>
              <Button ref={closeButton} type="button" variant="outline" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Canvas
              nodes={nodes}
              edges={edges}
              colorMode={colorMode}
              onSelect={select}
              onReady={instance => { overlay.current = instance; }}
            />
          </div>
          <p className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
            Press Escape to close. Selecting a node here also selects it on the page behind.
          </p>
        </div>
      )}

      {selected && <NodeDetail node={selected} />}

      <section className="flex flex-col gap-3" aria-labelledby="alternative">
        <h2 id="alternative" className="text-sm font-semibold tracking-tight">
          Every node, as text
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          The same content as the diagram. Select an entry to see its detail.
        </p>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {graph.nodes.map(node => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => select(node.id)}
                aria-pressed={node.id === selectedId}
                className={cn(
                  'flex w-full flex-col gap-1 bg-card px-4 py-3 text-left transition-colors',
                  'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  node.id === selectedId && 'bg-muted',
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{node.title}</span>
                  <Badge variant="outline" className="font-normal capitalize">{node.kind}</Badge>
                </span>
                <span className="text-sm text-muted-foreground text-pretty">{node.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NodeDetail({ node }: { node: GraphNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{node.title}</CardTitle>
        <p className="text-sm text-muted-foreground text-pretty">{node.summary}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {node.why !== null && (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why it exists</h3>
            <p className="text-sm text-pretty">{node.why}</p>
          </div>
        )}
        {node.sections.map(part => (
          <div key={part.label} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{part.label}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {part.items.map(item => (
                <li key={item} className="text-pretty">{item}</li>
              ))}
            </ul>
          </div>
        ))}
        {node.source !== null && node.reference !== null && (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Definition · {node.reference.kind} / {node.reference.id}
            </h3>
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
              {node.source}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import type { Metadata } from 'next';
import { GraphView } from '@/components/console/graph-view';
import { architectureGraph } from '@/lib/graph';

export const metadata: Metadata = {
  title: 'Architecture · AX Engineering Console',
  description: 'How a request moves through the harness, from a person to a reviewed change.',
};

export default function ArchitecturePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Architecture</h1>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          How a request moves through the harness, from a person asking for something to
          a reviewed change and what the harness learns from it. The map is built from
          the architecture definition, whose nodes reference the real roles, procedures
          and capabilities they stand for, so it cannot describe a part the harness does
          not define.
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          This is a visualization, not a diagram editor. Nodes cannot be moved,
          connected or deleted. Select a node to see what it is, why it exists, and the
          definition behind it.
        </p>
      </header>

      <GraphView graph={architectureGraph} label="Architecture map of the AX Harness" />
    </main>
  );
}

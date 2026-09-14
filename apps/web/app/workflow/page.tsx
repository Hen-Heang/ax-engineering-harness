import type { Metadata } from 'next';
import { GraphView } from '@/components/console/graph-view';
import { workflowGraph } from '@/lib/graph';

export const metadata: Metadata = {
  title: 'Workflow · AX Engineering Console',
  description: 'The engineering lifecycle, its permitted transitions, and its failure paths.',
};

export default function WorkflowPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Workflow</h1>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          The lifecycle a task moves through. Every state and every transition shown
          here is read from the lifecycle definition, including the dashed failure paths
          that return work to the state which can actually fix it.
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Nothing advances a state. No runner exists, so this shows which transitions
          are permitted rather than where any task currently is. A failure path counts
          as a retry and is bounded by the project&rsquo;s declared retry limit.
        </p>
      </header>

      <GraphView graph={workflowGraph} label="Engineering lifecycle states and transitions" />
    </main>
  );
}

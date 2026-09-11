import type { Metadata } from 'next';
import { PageHeader } from '@/components/console/page-header';
import { OutcomeBadge } from '@/components/console/outcome-badge';
import { SourceBlock } from '@/components/console/source-block';
import { catalog } from '@/lib/catalog';
import { gateOutcomes, gateViews, simulations } from '@/lib/simulation';

export const metadata: Metadata = {
  title: 'Quality gates · AX Engineering Console',
  description: 'The ordered checks a change must pass, and why unrun is not a pass.',
};

const kindLabels: Record<string, string> = {
  executable: 'Runs a declared command',
  eval: 'Assesses agent behaviour',
  human: 'Requires a person',
};

export default function QualityPage() {
  const pipelineEntry = catalog.pipeline[0];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Quality gates">
        <p>
          An ordered pipeline, cheapest checks first, so an expensive stage is only
          reached once the earlier ones have passed. A profile may supply the command
          for a stage; the project may override it; review and human approval cannot be
          disabled.
        </p>
        <p>
          <strong className="font-medium text-foreground">This console runs nothing.</strong>{' '}
          The harness can run these gates from the command line, with{' '}
          <code className="font-mono text-xs">ax run --execute</code>, after checking that
          the acting role holds the capability to do so. Reporting is the default, and
          every gate shown here is unrun.
        </p>
      </PageHeader>

      <section className="flex flex-col gap-3" aria-labelledby="outcomes">
        <h2 id="outcomes" className="text-sm font-semibold tracking-tight">
          The four outcomes
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          This distinction is where honest tooling is usually lost. A gate nobody could
          run and a gate nobody did run have not passed, and a pipeline that gates
          nothing does not report success.
        </p>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {gateOutcomes.map(outcome => (
            <li key={outcome.id} className="flex flex-col gap-1.5 bg-card px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="sm:w-32 sm:shrink-0">
                <OutcomeBadge outcome={outcome.id} />
              </span>
              <span className="text-sm text-muted-foreground text-pretty">{outcome.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="stages">
        <h2 id="stages" className="text-sm font-semibold tracking-tight">The pipeline</h2>
        <ol className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {gateViews.map((gate, index) => (
            <li key={gate.id} className="flex flex-col gap-1 bg-card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-medium">{gate.title}</span>
                <span className="text-xs text-muted-foreground">{kindLabels[gate.kind] ?? gate.kind}</span>
                {gate.command !== null && (
                  <code className="font-mono text-xs text-muted-foreground">commands.{gate.command}</code>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-pretty">{gate.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="by-profile">
        <h2 id="by-profile" className="text-sm font-semibold tracking-tight">
          Which gates each profile can supply
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          A profile supplies only the commands a project of that kind reliably has.
          Everything else must be declared by the project, or the gate stays unavailable
          rather than quietly passing.
        </p>
        <ul className="flex flex-col gap-4">
          {simulations.map(simulation => {
            const supplied = simulation.gates.filter(gate => gate.source === 'profile');
            const declared = simulation.gates.filter(gate => gate.source === 'project');
            return (
              <li key={simulation.id} className="flex flex-col gap-1.5 rounded-lg border bg-card px-4 py-3">
                <code className="font-mono text-sm">{simulation.id}</code>
                <p className="text-sm text-muted-foreground text-pretty">
                  Supplies{' '}
                  <span className="text-foreground">
                    {supplied.length > 0 ? supplied.map(gate => gate.title.toLowerCase()).join(', ') : 'nothing'}
                  </span>
                  . The project must declare {declared.map(gate => gate.title.toLowerCase()).join(', ')}.
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {pipelineEntry !== undefined && (
        <SourceBlock source={pipelineEntry.source} label="pipeline / default" />
      )}
    </main>
  );
}

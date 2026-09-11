import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { DefinitionList } from '@/components/console/definition-list';
import { ExampleNotice } from '@/components/console/example-notice';
import { failureBadgeClassName } from '@/components/console/outcome-badge';
import { PageHeader } from '@/components/console/page-header';
import { detailsOfKind } from '@/lib/definitions';
import { evalThreshold, exampleOutcomes } from '@/lib/simulation';

export const metadata: Metadata = {
  title: 'Evals · AX Engineering Console',
  description: 'Tests evaluate software. Evals evaluate how the agent worked.',
};

export default function EvalsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Evals">
        <p>
          A test asks whether the software is right. An eval asks whether the agent
          worked well: did it find the right owner, preserve the rules, add tests, avoid
          unrelated edits, and stay inside its permissions.
        </p>
        <p>
          <strong className="font-medium text-foreground">No evaluation has been run.</strong>{' '}
          The definitions and the scoring are real; no agent has been assessed, and no
          scores are stored in this repository.
        </p>
      </PageHeader>

      <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2" aria-label="Test versus eval">
        <div className="flex flex-col gap-1.5 bg-card px-4 py-3.5">
          <h2 className="text-sm font-medium">Application test</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Does this endpoint return the right response? Deterministic, and owned by
            the software.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 bg-card px-4 py-3.5">
          <h2 className="text-sm font-medium">Agent eval</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Did the agent identify the correct service, preserve the state rules, add
            tests, avoid unrelated changes, and follow the permission policy?
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="scoring">
        <div className="flex flex-col gap-2">
          <h2 id="scoring" className="text-sm font-semibold tracking-tight">
            How scoring behaves
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            Each judgement below is scored by the same function the harness uses, over
            example inputs, so these demonstrate the real rules. The pass threshold is{' '}
            {evalThreshold}% of the available weight.
          </p>
        </div>

        <ExampleNotice>
          These judgements are illustrations of the scoring rules. They are not the
          result of evaluating any agent, and nothing here was executed.
        </ExampleNotice>

        <ul className="flex flex-col gap-3">
          {exampleOutcomes.map(outcome => (
            <li key={outcome.label} className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-sm tabular-nums">{outcome.percent}%</span>
                <Badge
                  variant={outcome.passed ? 'default' : 'destructive'}
                  className={outcome.passed ? 'font-normal' : `font-normal ${failureBadgeClassName}`}
                >
                  {outcome.passed ? 'pass' : 'fail'}
                </Badge>
                <span className="text-sm font-medium">{outcome.label}</span>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">{outcome.note}</p>
              {outcome.missing.length > 0 && (
                <p className="text-sm text-muted-foreground text-pretty">
                  Scored zero because they were not judged:{' '}
                  <code className="font-mono text-xs">{outcome.missing.join(', ')}</code>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="definitions">
        <h2 id="definitions" className="text-sm font-semibold tracking-tight">Evaluation definitions</h2>
        <DefinitionList details={detailsOfKind('eval')} />
      </section>
    </main>
  );
}

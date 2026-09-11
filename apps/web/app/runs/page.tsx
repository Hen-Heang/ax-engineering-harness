import type { Metadata } from 'next';
import type { RunRecord } from '@ax-harness/core';
import { Badge } from '@/components/ui/badge';
import { ExampleNotice } from '@/components/console/example-notice';
import { OutcomeBadge } from '@/components/console/outcome-badge';
import { PageHeader } from '@/components/console/page-header';
import { SourceBlock } from '@/components/console/source-block';
import { catalog } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Runs · AX Engineering Console',
  description: 'Execution history. Every record here is an example; nothing has been executed.',
};

export default function RunsPage() {
  const runs = catalog.run.map(entry => ({ entry, record: entry.definition as RunRecord }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Runs">
        <p>
          A run record describes one task execution: what was asked, which role owned
          it, which files were read and changed, and how each gate turned out.
        </p>
        <p>
          <strong className="font-medium text-foreground">Nothing here was executed.</strong>{' '}
          The harness has no execution engine, so every record is an example. A record
          may only claim to be recorded if a real execution produced it, and the
          validator rejects one that claims otherwise.
        </p>
      </PageHeader>

      <ExampleNotice>
        The run below is illustrative. Its duration, files and gate outcomes were written
        as a demonstration of the record format, not produced by running anything.
      </ExampleNotice>

      <ul className="flex flex-col gap-6">
        {runs.map(({ entry, record }) => (
          <li key={record.id} className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-4">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm">{record.id}</code>
                <Badge variant="outline" className="font-normal">{record.kind}</Badge>
                <Badge variant="secondary" className="font-normal">{record.status}</Badge>
              </div>
              <p className="text-sm text-pretty">{record.task}</p>
            </header>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="font-mono text-xs">{record.agent}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Profile</dt>
                <dd className="font-mono text-xs">{record.profile}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="font-mono text-xs tabular-nums">
                  {record.durationSeconds === undefined ? 'unmeasured' : `${record.durationSeconds}s`}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Retries</dt>
                <dd className="font-mono text-xs tabular-nums">{record.retries}</dd>
              </div>
            </dl>

            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gate outcomes
              </h2>
              <ul className="flex flex-col gap-px overflow-hidden rounded-md border bg-border">
                {record.gates.map(gate => (
                  <li key={gate.stage} className="flex items-center justify-between gap-3 bg-card px-3 py-2">
                    <code className="font-mono text-xs">{gate.stage}</code>
                    <OutcomeBadge outcome={gate.outcome} />
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground text-pretty">
                Integration tests are reported as unavailable rather than passed, because
                the profile supplies no command for them.
              </p>
            </section>

            <section className="flex flex-col gap-1.5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Measurements
              </h2>
              <p className="text-sm text-muted-foreground text-pretty">
                {record.measurements === undefined
                  ? 'None were taken. An absent measurement means unmeasured, never zero, so no token count or cost is shown as free.'
                  : 'Recorded measurements are shown as taken.'}
              </p>
            </section>

            <SourceBlock source={entry.source} label={`run / ${record.id}`} />
          </li>
        ))}
      </ul>
    </main>
  );
}

import type { Metadata } from 'next';
import { ConfigTree } from '@/components/console/config-tree';
import { PageHeader } from '@/components/console/page-header';
import { catalogSummary } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Config explorer · AX Engineering Console',
  description: 'Browse every definition the console is allowed to show, with its real source.',
};

export default function ConfigPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Config explorer">
        <p>
          Every definition the harness holds, with the real source behind it.{' '}
          {catalogSummary.total} definitions across {Object.keys(catalogSummary.counts).length} kinds.
        </p>
        <p>
          <strong className="font-medium text-foreground">This tree is not a filesystem.</strong>{' '}
          Every branch is a catalog kind and every leaf a definition the allowlist already
          exposes, so nothing here can name a path on disk or reach a file the console is
          not allowed to show.
        </p>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:border-r lg:pr-4">
          <ConfigTree />
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          Select a definition to inspect it.
        </p>
      </div>
    </main>
  );
}

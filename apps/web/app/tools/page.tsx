import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DefinitionList } from '@/components/console/definition-list';
import { PageHeader } from '@/components/console/page-header';
import { capabilities } from '@/lib/catalog';
import { detailsOfKind } from '@/lib/definitions';

export const metadata: Metadata = {
  title: 'MCP & tools · AX Engineering Console',
  description: 'MCP is the interface; a tool is the capability. Neither is connected yet.',
};

const toolNames: Record<string, string> = {
  codebase: 'Codebase',
  docs: 'Documentation',
  github: 'GitHub',
  database: 'Database metadata',
  none: 'No tool required',
};

const chain = ['Agent', 'Capability policy', 'MCP', 'Tool', 'External system'];

export default function ToolsPage() {
  const byTool = new Map<string, string[]>();
  for (const { capability } of capabilities) {
    const list = byTool.get(capability.tool) ?? [];
    list.push(capability.id);
    byTool.set(capability.tool, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="MCP and tools">
        <p>
          MCP is a standardised connection, and a tool is the capability reached through
          it. Keeping every outside reach behind one interface is what makes it possible
          to bound that reach at all. MCP is the interface layer, never the business logic.
        </p>
        <p>
          <strong className="font-medium text-foreground">No connection exists.</strong>{' '}
          Nothing here opens a socket, calls an API, or reads a database. The capability
          each tool would carry is declared; the carrying is not implemented.
        </p>
      </PageHeader>

      <section className="flex flex-col gap-3" aria-labelledby="chain">
        <h2 id="chain" className="text-sm font-semibold tracking-tight">
          How a request would reach outside
        </h2>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {chain.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="rounded-md border bg-card px-2.5 py-1 text-sm">{step}</span>
              {index < chain.length - 1 && (
                <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </li>
          ))}
        </ol>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          The policy sits before the interface on purpose. A capability a role does not
          hold should never reach the transport at all.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="integrations">
        <h2 id="integrations" className="text-sm font-semibold tracking-tight">Integrations</h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {[...byTool.entries()].map(([tool, ids]) => (
            <li
              key={tool}
              className="flex flex-col gap-2 bg-card px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
                <span className="text-sm font-medium">{toolNames[tool] ?? tool}</span>
                <span className="text-sm text-muted-foreground text-pretty">
                  Carries {ids.length} {ids.length === 1 ? 'capability' : 'capabilities'}:{' '}
                  {ids.join(', ')}.
                </span>
              </div>
              <Badge variant="outline" className="w-fit shrink-0 font-normal">
                {tool === 'none' ? 'Not applicable' : 'Planned'}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground text-pretty">
          Every integration is Planned because none has been built. The capabilities are
          real declarations; the connections behind them are not.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="adapters">
        <h2 id="adapters" className="text-sm font-semibold tracking-tight">Vendor adapters</h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          An adapter is the file a vendor tool reads first, and nothing more. It holds no
          capabilities of its own: permissions come from the policy, not from which tool
          is being used.
        </p>
        <DefinitionList details={detailsOfKind('adapter')} />
      </section>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfigTree } from '@/components/console/config-tree';
import { DefinitionSections } from '@/components/console/definition-sections';
import { SourceBlock } from '@/components/console/source-block';
import { StatusBadge } from '@/components/console/status-badge';
import { catalog, catalogKinds } from '@/lib/catalog';
import { detailFor } from '@/lib/definitions';

interface Params {
  params: Promise<{ kind: string; id: string }>;
}

/**
 * One page per catalog entry, so every definition is deep-linkable and the whole
 * explorer stays static. The parameters come from the catalog, which means a route
 * cannot exist for something the allowlist does not expose.
 */
export function generateStaticParams(): { kind: string; id: string }[] {
  return catalogKinds.flatMap(kind => catalog[kind].map(entry => ({ kind, id: entry.id })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kind, id } = await params;
  const detail = detailFor(kind, id);
  if (!detail) return { title: 'Not found · AX Engineering Console' };
  return {
    title: `${detail.title} · Config explorer`,
    description: detail.summary,
  };
}

export default async function ConfigEntryPage({ params }: Params) {
  const { kind, id } = await params;
  const detail = detailFor(kind, id);
  if (!detail) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:border-r lg:pr-4">
          <ConfigTree activeKind={detail.kind} activeId={detail.id} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              {detail.kind} / {detail.id}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {detail.title}
              </h1>
              <StatusBadge status={detail.status} />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{detail.summary}</p>
          </header>

          {detail.sections.length > 0 && <DefinitionSections sections={detail.sections} />}

          <SourceBlock source={detail.source} label={`${detail.kind} / ${detail.id}`} />

          <p className="text-xs text-muted-foreground text-pretty">
            Rendered from the loaded definition rather than read from disk, so there is no
            file path for a request to influence.
          </p>
        </div>
      </div>
    </main>
  );
}

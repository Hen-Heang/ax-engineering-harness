import Link from 'next/link';
import { cn } from '@/lib/utils';
import { catalog, catalogKinds, type CatalogKind } from '@/lib/catalog';

const kindLabels: Record<CatalogKind, string> = {
  profile: 'profiles',
  agent: 'agents',
  skill: 'skills',
  adapter: 'adapters',
  policy: 'policies',
  pipeline: 'quality',
  workflow: 'workflow',
  eval: 'evals',
  run: 'runs',
};

/**
 * The catalog as a tree.
 *
 * This looks like a file tree and is not one. Every branch is a catalog kind and
 * every leaf a definition the allowlist already exposes, so nothing here can name a
 * path on disk or reach a file the console is not allowed to show.
 */
export function ConfigTree({ activeKind, activeId }: { activeKind?: string; activeId?: string }) {
  return (
    <nav aria-label="Catalog" className="flex flex-col gap-4 text-sm">
      <p className="font-mono text-xs text-muted-foreground">harness/</p>
      {catalogKinds.map(kind => (
        <div key={kind} className="flex flex-col gap-0.5">
          <p className="pl-3 font-mono text-xs text-muted-foreground">{kindLabels[kind]}/</p>
          <ul className="flex flex-col gap-0.5">
            {catalog[kind].map(entry => {
              const active = kind === activeKind && entry.id === activeId;
              return (
                <li key={entry.id}>
                  <Link
                    href={`/config/${kind}/${entry.id}`}
                    {...(active ? { 'aria-current': 'page' as const } : {})}
                    className={cn(
                      'flex min-h-9 items-center rounded-md pl-6 pr-2 font-mono text-xs transition-colors',
                      'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active && 'bg-muted font-medium text-foreground',
                    )}
                  >
                    {entry.id}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/console/status-badge';
import { DefinitionSections } from '@/components/console/definition-sections';
import type { DefinitionDetail } from '@/lib/definitions';

/**
 * A list of definitions, each expandable in place.
 *
 * Expansion uses native details/summary rather than a scripted accordion, so it
 * works with the keyboard, works before hydration, and ships no client JavaScript.
 */
export function DefinitionList({ details }: { details: DefinitionDetail[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {details.map(detail => (
        <li key={detail.id}>
          <details className="group rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <ChevronRight
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{detail.title}</span>
                  <code className="font-mono text-xs text-muted-foreground">{detail.id}</code>
                </span>
                <span className="text-sm text-muted-foreground text-pretty">{detail.summary}</span>
              </span>
              <span className="shrink-0">
                <StatusBadge status={detail.status} />
              </span>
            </summary>
            <div className="flex flex-col gap-4 border-t px-4 py-4">
              <DefinitionSections sections={detail.sections} />
              <Link
                href={`/config/${detail.kind}/${detail.id}`}
                className="w-fit text-sm underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Inspect the definition source
              </Link>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

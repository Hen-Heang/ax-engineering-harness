import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Marks illustrative content where it is displayed.
 *
 * Nothing in this console has been executed or evaluated, so any record or score on
 * screen is an example. Labelling it next to the content, rather than once in a
 * footnote, is what keeps a screenshot of it honest.
 */
export function ExampleNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground text-pretty">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-medium text-foreground">Example.</strong> {children}
      </span>
    </p>
  );
}

/**
 * A definition's real source.
 *
 * The text is rendered from the loaded definition rather than read from disk, so
 * there is no file path for a request to influence. The block scrolls on purpose:
 * source is one of the few things allowed to be wider than the page.
 */
export function SourceBlock({ source, label }: { source: string; label: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </figcaption>
      <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
        {source}
      </pre>
    </figure>
  );
}

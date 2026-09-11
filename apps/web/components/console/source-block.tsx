/**
 * A definition's real source.
 *
 * The text is rendered from the loaded definition rather than read from disk, so
 * there is no file path for a request to influence. The block scrolls on purpose:
 * source is one of the few things allowed to be wider than the page.
 *
 * Because it scrolls, it must be reachable by keyboard, or someone navigating without
 * a pointer cannot read past the first screenful. `tabIndex` makes it focusable and
 * the label gives it a name once it is focused.
 */
export function SourceBlock({ source, label }: { source: string; label: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </figcaption>
      <pre
        tabIndex={0}
        role="region"
        aria-label={`${label} source`}
        className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {source}
      </pre>
    </figure>
  );
}

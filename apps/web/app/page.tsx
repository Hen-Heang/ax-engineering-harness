import { catalog, catalogKinds, catalogSummary } from '@/lib/catalog';

const kindLabels: Record<string, string> = {
  profile: 'Profiles',
  agent: 'Agent roles',
  skill: 'Skills',
  adapter: 'Vendor adapters',
  policy: 'Capability policy',
  pipeline: 'Quality pipeline',
  workflow: 'Lifecycle',
  eval: 'Evaluations',
  run: 'Run records',
};

export default function OverviewPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-widest text-(--color-ink-muted)">
          Experimental · Learning project
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">AX Engineering Console</h1>
        <p className="text-base text-(--color-ink-muted) text-pretty">
          A reusable engineering layer for reliable AI-assisted software development.
          This console renders the harness&rsquo;s own definitions, so what it shows and
          what the harness does cannot drift apart.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">
          Catalog ({catalogSummary.total} definitions)
        </h2>
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-(--color-border-subtle) bg-(--color-border-subtle) sm:grid-cols-2">
          {catalogKinds.map(kind => (
            <li key={kind} className="flex items-baseline justify-between gap-4 bg-(--color-surface-raised) px-4 py-3">
              <span className="text-sm">{kindLabels[kind] ?? kind}</span>
              <span className="font-mono text-sm text-(--color-ink-muted)">{catalog[kind].length}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-(--color-border-subtle) px-4 py-4">
        <h2 className="text-sm font-semibold tracking-tight">What this console does not do</h2>
        <p className="text-sm text-(--color-ink-muted) text-pretty">
          It reads no repository files, runs no commands, and records no executions.
          Every definition shown is compiled into the page from an explicit allowlist.
          Navigation, diagrams, the configuration explorer, and the adoption simulator
          arrive in later phases.
        </p>
      </section>
    </main>
  );
}

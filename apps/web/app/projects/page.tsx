import type { Metadata } from 'next';
import { PageHeader } from '@/components/console/page-header';
import { StackSimulator } from '@/components/console/stack-simulator';
import { simulations, stackNeutral } from '@/lib/simulation';

export const metadata: Metadata = {
  title: 'Projects · AX Engineering Console',
  description: 'How a repository adopts the harness, and what each stack would activate.',
};

const adoptionSteps = [
  {
    title: 'Add .ax/project.yaml',
    detail: 'Declare the profile, context references, commands, tools, permissions, gates and limits. Nothing is defaulted silently.',
  },
  {
    title: 'Keep AGENTS.md',
    detail: 'The vendor-neutral instructions live with the repository. A vendor entrypoint defers to them rather than restating them.',
  },
  {
    title: 'Validate the declaration',
    detail: 'npm run ax -- validate resolves the profile, detects the build system, and reports which commands came from where.',
  },
  {
    title: 'Plan the gates',
    detail: 'npm run ax -- quality shows which gates apply and which have a command. It runs none of them.',
  },
];

export default function ProjectsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Projects">
        <p>
          A repository adopts the harness by declaring what it is and what may be done
          to it. The harness holds no project-specific settings: everything particular
          to a codebase lives with that codebase.
        </p>
      </PageHeader>

      <section className="flex flex-col gap-3" aria-labelledby="adoption">
        <h2 id="adoption" className="text-sm font-semibold tracking-tight">Adopting it</h2>
        <ol className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {adoptionSteps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-1 bg-card px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="simulator">
        <h2 id="simulator" className="text-sm font-semibold tracking-tight">What a stack activates</h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Choose a stack to see what its profile would resolve and which gates it could
          supply. This runs from validated configuration compiled into the page: it
          resolves nothing at request time, reaches no filesystem, and starts nothing.
        </p>
        <StackSimulator simulations={simulations} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="neutral">
        <h2 id="neutral" className="text-sm font-semibold tracking-tight">What does not change</h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Only the profile layer varies by stack. The {stackNeutral.roles.length} roles,
          the {stackNeutral.skillCount} procedures, and the capability policy are the
          same whichever stack is adopted, because the harness core is deliberately free
          of stack assumptions. A Spring service and a Next.js application are reviewed
          by the same roles under the same denials.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {stackNeutral.roles.map(role => (
            <li key={role.id} className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
              {role.title}
            </li>
          ))}
        </ul>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Denied to every role in every stack:{' '}
          <code className="font-mono text-xs">{stackNeutral.deniedCapabilities.join(', ')}</code>.
        </p>
      </section>
    </main>
  );
}

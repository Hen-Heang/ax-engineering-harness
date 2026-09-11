import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/console/page-header';

export const metadata: Metadata = {
  title: 'Docs · AX Engineering Console',
  description: 'Where to start, and where the authoritative documents live.',
};

const quickStart = [
  { command: 'npm ci', detail: 'Install the workspace. Node 24 LTS is the recommended runtime.' },
  { command: 'npm run ax -- validate', detail: 'Resolve a project declaration and check its context references.' },
  { command: 'npm run ax -- quality', detail: 'Plan the gates for a project. Runs none of them.' },
  { command: 'npm run ax -- policy', detail: 'Print the capability matrix from the definitions.' },
  { command: 'npm run check', detail: 'Build, typecheck, lint, test both packages, and build the console.' },
];

const topics = [
  { title: 'Architecture', href: '/architecture', document: 'docs/visualizations.md', detail: 'How a request moves from a person to a reviewed change.' },
  { title: 'Workflow and handoff', href: '/workflow', document: 'docs/workflow.md', detail: 'Lifecycle states, permitted transitions, bounded retries, and what a handoff must record.' },
  { title: 'Project configuration', href: '/config', document: 'docs/project-configuration.md', detail: 'The declaration contract: fields, limits, and what validation does not authorise.' },
  { title: 'Profiles', href: '/profiles', document: 'docs/profiles.md', detail: 'Stack assumptions, build detection, and what each profile refuses to assume.' },
  { title: 'Agents and skills', href: '/agents', document: 'docs/agents-and-skills.md', detail: 'Roles and procedures, and why an agent is not a skill.' },
  { title: 'MCP and tools', href: '/tools', document: 'docs/adapters.md', detail: 'The interface layer, and the vendor entrypoints that reach the shared instructions.' },
  { title: 'Permissions', href: '/policies', document: 'docs/policies.md', detail: 'The capability vocabulary, what requires approval, and what is denied to everyone.' },
  { title: 'Quality gates', href: '/quality', document: 'docs/quality-and-evals.md', detail: 'The pipeline, and why unavailable and unrun are not passes.' },
  { title: 'Evals', href: '/evals', document: 'docs/quality-and-evals.md', detail: 'Assessing agent behaviour rather than software.' },
  { title: 'Adoption', href: '/projects', document: 'README.md', detail: 'Applying the harness to an existing repository.' },
];

export default function DocsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Docs">
        <p>
          The AX Engineering Harness is a reusable engineering layer for reliable
          AI-assisted software development: context, roles, procedures, controlled
          capability, verification and evaluation, kept in the repository rather than in
          a prompt.
        </p>
        <p>
          It is an experimental learning project. The contracts and their validation are
          real; execution is not. Nothing in it runs a command, starts an agent, or
          enforces a permission.
        </p>
      </PageHeader>

      <section className="flex flex-col gap-3" aria-labelledby="quick-start">
        <h2 id="quick-start" className="text-sm font-semibold tracking-tight">Quick start</h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {quickStart.map(step => (
            <li key={step.command} className="flex flex-col gap-1 bg-card px-4 py-3">
              <code className="font-mono text-xs">{step.command}</code>
              <span className="text-sm text-muted-foreground text-pretty">{step.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="topics">
        <h2 id="topics" className="text-sm font-semibold tracking-tight">Topics</h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Each topic has a page in this console and an authoritative document in the
          repository. The document is the source of record; this console renders the
          definitions those documents describe.
        </p>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {topics.map(topic => (
            <li key={topic.title} className="flex flex-col gap-1 bg-card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={topic.href}
                  className="text-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {topic.title}
                </Link>
                <code className="font-mono text-xs text-muted-foreground">{topic.document}</code>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">{topic.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-dashed px-4 py-4" aria-labelledby="honesty">
        <h2 id="honesty" className="text-sm font-semibold tracking-tight">What to expect</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li className="text-pretty">Definitions, schemas and validation are implemented and tested.</li>
          <li className="text-pretty">Roles, procedures, gates and evals are defined; no runtime carries them out.</li>
          <li className="text-pretty">MCP connections, gate execution and real runs are planned, not built.</li>
          <li className="text-pretty">Every record and score displayed here is an example, labelled where it appears.</li>
        </ul>
      </section>
    </main>
  );
}

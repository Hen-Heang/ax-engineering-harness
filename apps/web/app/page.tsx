import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/console/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { catalog, catalogSummary, statusBreakdown } from '@/lib/catalog';

const mentalModel = ['Human', 'Harness', 'Agent', 'Tools', 'Software', 'Verification', 'Feedback'];

const pillars = ['Context', 'Agents', 'Skills', 'MCP', 'Guardrails', 'Quality gates', 'Evals'];

const buildingBlocks = [
  { kind: 'agent', label: 'Agent roles' },
  { kind: 'skill', label: 'Skills' },
  { kind: 'adapter', label: 'Vendor adapters' },
  { kind: 'eval', label: 'Evaluations' },
] as const;

export default function OverviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-5 py-10 sm:px-8 lg:py-14">
      <header className="flex flex-col gap-5">
        <Badge variant="outline" className="w-fit font-normal">
          Experimental · learning project
        </Badge>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            AX Engineering Harness
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground text-pretty">
            A reusable engineering layer for reliable AI-assisted software development.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          {pillars.map(pillar => (
            <li key={pillar} className="rounded border px-2 py-0.5">{pillar}</li>
          ))}
        </ul>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="model">
        <h2 id="model" className="text-sm font-semibold tracking-tight">The mental model</h2>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {mentalModel.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="rounded-md border bg-card px-2.5 py-1 text-sm">{step}</span>
              {index < mentalModel.length - 1 && (
                <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </li>
          ))}
        </ol>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Reliable AI-assisted engineering is more than asking a model to generate code.
          It is a human directing an agent that works through defined procedures, using
          controlled tools, against a project whose changes are verified and evaluated.
        </p>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="What, why and how">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What it is</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-pretty">
            A vendor-neutral core of contracts: project configuration, stack profiles,
            roles, procedures, capability policy, quality gates and evaluations.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Why it exists</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-pretty">
            An agent is only as reliable as the context, boundaries and verification
            around it. Those belong in the repository, not in a prompt.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-pretty">
            A project declares <code className="font-mono text-xs">.ax/project.yaml</code>.
            The harness resolves it against a profile, then plans the gates that a change
            must pass.
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="profiles">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="profiles" className="text-sm font-semibold tracking-tight">Stack profiles</h2>
          <p className="text-xs text-muted-foreground">Status as each profile declares it</p>
        </div>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {catalog.profile.map(profile => (
            <li key={profile.id} className="flex flex-col gap-2 bg-card px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
                <span className="font-mono text-sm">{profile.id}</span>
                <span className="text-sm text-muted-foreground text-pretty">{profile.summary}</span>
              </div>
              <div className="shrink-0">
                <StatusBadge status={profile.status} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="blocks">
        <h2 id="blocks" className="text-sm font-semibold tracking-tight">
          Building blocks ({catalogSummary.total} definitions)
        </h2>
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          {buildingBlocks.map(block => (
            <li key={block.kind} className="flex flex-col gap-2 bg-card px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{block.label}</span>
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {catalog[block.kind].length}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {statusBreakdown(block.kind).map(({ status, count }) => (
                  <li key={status} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StatusBadge status={status} />
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-4" aria-labelledby="limits">
        <h2 id="limits" className="text-sm font-semibold tracking-tight">What this does not do</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>This console runs nothing. Gate execution lives in the command line tool.</li>
          <li>It executes no agent and runs no evaluation, and connects to no tool.</li>
          <li>It reads no repository file. This console renders an allowlisted catalog only.</li>
          <li>It reports no measurement that was not taken, and labels every example as one.</li>
        </ul>
      </section>
    </main>
  );
}

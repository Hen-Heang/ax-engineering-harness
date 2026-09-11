import type { Metadata } from 'next';
import { DefinitionList } from '@/components/console/definition-list';
import { PageHeader } from '@/components/console/page-header';
import { detailsOfKind } from '@/lib/definitions';

export const metadata: Metadata = {
  title: 'Skills · AX Engineering Console',
  description: 'Reusable procedures: their steps, the capabilities they need, and how to verify them.',
};

export default function SkillsPage() {
  const skills = detailsOfKind('skill');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Skills">
        <p>
          A skill is a procedure, not a worker. Where an agent answers <em>who owns
          this</em>, a skill answers <em>how it is done</em>: ordered steps, the
          capabilities they need, and how to tell the procedure was actually followed.
        </p>
        <p>
          One role may follow many procedures, and one procedure may be followed by many
          roles. A role that lists a procedure must hold every capability that procedure
          needs, and the registry refuses to load a set of definitions where it does not.
        </p>
      </PageHeader>

      <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        <div className="flex flex-col gap-1 bg-card px-4 py-3">
          <dt className="text-sm font-medium">Agent</dt>
          <dd className="text-sm text-muted-foreground">A role. Holds capabilities and responsibilities.</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card px-4 py-3">
          <dt className="text-sm font-medium">Skill</dt>
          <dd className="text-sm text-muted-foreground">A procedure. Holds steps and verification.</dd>
        </div>
      </dl>

      <DefinitionList details={skills} />
    </main>
  );
}

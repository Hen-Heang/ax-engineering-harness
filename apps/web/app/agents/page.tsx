import type { Metadata } from 'next';
import { DefinitionList } from '@/components/console/definition-list';
import { PageHeader } from '@/components/console/page-header';
import { detailsOfKind } from '@/lib/definitions';

export const metadata: Metadata = {
  title: 'Agents · AX Engineering Console',
  description: 'Engineering roles, their capabilities, and what each must never do.',
};

export default function AgentsPage() {
  const agents = detailsOfKind('agent');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Agents">
        <p>
          An agent is a role with bounded responsibilities, not a running process.
          Defining {agents.length} roles starts nothing, implies no parallel execution,
          and grants no access: the harness has no runner.
        </p>
        <p>
          Ownership is deliberately non-overlapping. The investigator does not plan, the
          planner does not implement, and a reviewer may not edit the code it judges,
          because a reviewer who can quietly fix what it finds stops being a reviewer.
        </p>
      </PageHeader>
      <DefinitionList details={agents} />
    </main>
  );
}

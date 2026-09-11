import type { Metadata } from 'next';
import { CapabilityMatrix } from '@/components/console/capability-matrix';
import { PageHeader } from '@/components/console/page-header';
import { SourceBlock } from '@/components/console/source-block';
import { capabilities, catalog } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Policies · AX Engineering Console',
  description: 'The capability matrix: controlled capability rather than maximum autonomy.',
};

export default function PoliciesPage() {
  const roles = catalog.agent.map(agent => ({ id: agent.id, title: agent.title }));
  const denied = capabilities.filter(row => row.capability.deniedToAllAgents);
  const approval = capabilities.filter(row => row.capability.humanApproval);
  const editors = capabilities.find(row => row.capability.id === 'edit_worktree')?.agents ?? [];
  const policy = catalog.policy[0];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Policies">
        <p>
          AX engineering is about controlled capability, not maximum autonomy. Reads are
          broad, writes are narrow and reviewed, and the highest-impact actions belong to
          people. {editors.length} of {roles.length} roles may change a file.
        </p>
        <p>
          <strong className="font-medium text-foreground">One capability is now enforced.</strong>{' '}
          The gate runner checks{' '}
          <code className="font-mono text-xs">run_tests</code> before running anything, so a
          role without it runs no command. Every other row is still only a declaration: it
          opens no connection and constrains no tool, and must not be mistaken for a
          security boundary.
        </p>
      </PageHeader>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="matrix">
        <h2 id="matrix" className="text-sm font-semibold tracking-tight">Capability matrix</h2>
        <CapabilityMatrix rows={capabilities} roles={roles} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Denials and approvals">
        <div className="flex flex-col gap-2 rounded-lg border border-dashed px-4 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Denied to every role</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {denied.map(row => (
              <li key={row.capability.id} className="text-pretty">
                <code className="font-mono text-xs text-foreground">{row.capability.id}</code>
                {' — '}
                {row.capability.description}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground text-pretty">
            These use the same identifiers as the five permissions a project declaration
            forces to false, and a test asserts the two sets stay identical.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border px-4 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Requires human approval</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {approval.map(row => (
              <li key={row.capability.id} className="text-pretty">
                <code className="font-mono text-xs text-foreground">{row.capability.id}</code>
                {' — '}
                {row.capability.description}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground text-pretty">
            Approval is a property of the capability, not a per-role exception, and it
            cannot unlock anything the policy denies outright.
          </p>
        </div>
      </section>

      {policy !== undefined && <SourceBlock source={policy.source} label="policy / default" />}
    </main>
  );
}

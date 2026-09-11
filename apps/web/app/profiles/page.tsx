import type { Metadata } from 'next';
import { DefinitionList } from '@/components/console/definition-list';
import { PageHeader } from '@/components/console/page-header';
import { detailsOfKind } from '@/lib/definitions';

export const metadata: Metadata = {
  title: 'Profiles · AX Engineering Console',
  description: 'Stack profiles: what each detects, what it supplies, and what it refuses to assume.',
};

export default function ProfilesPage() {
  const profiles = detailsOfKind('profile');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader title="Profiles">
        <p>
          A profile holds the stack assumptions that must not live in the harness core.
          It may supply a command for a gate the project omitted, and it records the
          architecture assumptions a change should preserve.
        </p>
        <p>
          A profile may never enable a gate, relax a permission, or mark an unavailable
          gate as satisfied. What each one supplies, and what it deliberately does not,
          is read from the definition below.
        </p>
      </PageHeader>
      <DefinitionList details={profiles} />
    </main>
  );
}

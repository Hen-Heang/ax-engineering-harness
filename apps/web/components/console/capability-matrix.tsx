import { Check, Minus } from 'lucide-react';
import type { MatrixRow } from '@ax-harness/core';

/**
 * The capability matrix, exactly as the definitions state it.
 *
 * The table is wide by nature, so it scrolls inside its own container rather than
 * widening the page. That is the one place horizontal scrolling is intended.
 *
 * The container's `relative` is load-bearing. Every cell carries an `sr-only` label,
 * which is absolutely positioned; with no positioned ancestor their containing block
 * is the initial one, so they escape the scroller's clipping and widen the whole page
 * by the table's overhang. Positioning the scroller keeps them inside it.
 */
export function CapabilityMatrix({
  rows,
  roles,
}: {
  rows: MatrixRow[];
  roles: { id: string; title: string }[];
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Capability matrix, scrollable"
      className="relative min-w-0 max-w-full overflow-x-auto rounded-lg border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <table className="w-full min-w-184 border-collapse text-sm">
        <caption className="sr-only">
          Which role holds which capability, as the policy declares it. Only run_tests is enforced, by the quality executor.
        </caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Capability</th>
            {roles.map(role => (
              <th key={role.id} scope="col" className="px-2 py-2.5 text-center align-bottom font-medium">
                <span className="block text-xs leading-tight">{role.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ capability, agents }) => (
            <tr key={capability.id} className="border-b last:border-b-0">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="flex flex-col gap-0.5">
                  <code className="font-mono text-xs">{capability.id}</code>
                  <span className="text-xs text-muted-foreground">
                    {capability.deniedToAllAgents
                      ? 'Denied to every role'
                      : capability.humanApproval
                        ? 'Requires human approval'
                        : capability.title}
                  </span>
                </span>
              </th>
              {roles.map(role => {
                const held = agents.includes(role.id);
                return (
                  <td key={role.id} className="px-2 py-2 text-center">
                    {held ? (
                      <>
                        <Check aria-hidden="true" className="mx-auto size-4" />
                        <span className="sr-only">{role.title} holds {capability.id}</span>
                      </>
                    ) : (
                      <>
                        <Minus aria-hidden="true" className="mx-auto size-4 text-muted-foreground/40" />
                        <span className="sr-only">{role.title} does not hold {capability.id}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

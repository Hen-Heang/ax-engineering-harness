'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const itemBase = 'flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm lg:min-h-9';

/**
 * The section list, shared by the desktop sidebar and the mobile sheet.
 *
 * An item whose page does not exist yet is rendered as text rather than a link, so
 * the navigation never offers a destination that is not there.
 */
export function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Console sections" className="flex flex-col gap-5">
      {navigation.map(section => (
        <div key={section.label ?? 'primary'} className="flex flex-col gap-1">
          {section.label !== null && (
            <h2 className="px-3 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </h2>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map(item => {
              const Icon = item.icon;
              const active = item.href !== null && pathname === item.href;

              return (
                <li key={item.label}>
                  {item.href === null ? (
                    <span className={cn(itemBase, 'text-muted-foreground/70')}>
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      <span className="sr-only">, not yet available</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 rounded border px-1.5 py-px text-[0.625rem]"
                      >
                        Phase {item.phase}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      // Spread conditionally: exactOptionalPropertyTypes rejects an
                      // explicit undefined for an optional prop.
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                      className={cn(
                        itemBase,
                        'transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        active && 'bg-muted font-medium text-foreground',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

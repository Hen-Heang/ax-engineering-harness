import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      <div className="flex max-w-2xl flex-col gap-2 text-sm text-muted-foreground text-pretty">{children}</div>
    </header>
  );
}

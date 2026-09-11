'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { ConsoleNav } from './console-nav';

/**
 * The persistent console frame: a sidebar on wide screens, a sheet below.
 *
 * The main column carries `min-w-0` so that a wide child, such as a source block,
 * scrolls inside its own container instead of widening the page.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <header className="flex items-center gap-3 border-b px-4 py-2.5 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            {/* size-11 keeps the touch target at 44px; the icon button default is smaller. */}
            <Button variant="outline" size="icon" className="size-11" aria-label="Open navigation">
              <Menu className="size-4" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-sm">AX Engineering Console</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-2 py-4">
              <ConsoleNav onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-medium">AX Engineering Console</span>
      </header>

      <aside className="hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-0 flex max-h-dvh flex-col gap-5 overflow-y-auto px-2 py-5">
          <div className="px-3">
            <p className="text-sm font-semibold tracking-tight">AX Engineering Console</p>
            <p className="text-xs text-muted-foreground">Experimental · learning project</p>
          </div>
          <ConsoleNav />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

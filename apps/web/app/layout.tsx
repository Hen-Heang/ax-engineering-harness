import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist } from 'next/font/google';
import { ConsoleShell } from '@/components/console/console-shell';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'AX Engineering Console',
  description: 'A reusable engineering layer for reliable AI-assisted software development.',
};

/**
 * Applies the viewer's colour-scheme preference before first paint.
 *
 * The shadcn tokens key dark mode off a `dark` class, which the server cannot know.
 * This runs ahead of rendering to avoid a flash, and the page stays readable in the
 * light palette if it does not run at all.
 */
const applyColorScheme = `try{if(matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyColorScheme }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}

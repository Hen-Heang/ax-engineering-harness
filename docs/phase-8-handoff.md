# Phase 8 handoff

Goal: give the console its persistent navigation and a real Overview page, with the
sidebar collapsing to a sheet on mobile and every status label taken from the
definition that declares it.

Status: complete for Phase 8. The architecture and workflow diagrams, the
configuration explorer, the building-block pages, and the adoption simulator remain
unimplemented.

## Completed

Initialised shadcn with the Radix Nova preset and added Button, Badge, Card,
Separator and Sheet. Added the navigation model, the console shell with a desktop
sidebar and a mobile sheet, a status badge driven by the declarations, and the
Overview page. Added `statusBreakdown` to the catalog and five navigation tests,
including one that refuses a link to a page that does not exist. Verified the narrow
layout in Chrome and fixed two defects it revealed. No legacy project files changed.

Changed areas: `apps/web/` (components, lib, app, tests, package.json,
globals.css), `package-lock.json`, `README.md`, and `docs/`.

## Decisions

- Every planned section is listed from the start, but an item whose page does not
  exist carries no href and renders as text with a phase marker. A test asserts each
  href resolves to a real page file, so a link cannot precede its page.
- Status labels come from `statusBreakdown`, which counts what each definition
  declares, rather than from a maintained list on the page.
- The generator's choices were corrected where they conflicted with the repository:
  caret ranges pinned to exact versions, and `clsx` and `tailwind-merge` dropped once
  nothing imported them directly. `shadcn` stays a dependency only because
  `globals.css` imports `shadcn/tailwind.css`.
- Generated components import `cn` from the published package rather than the
  `components.json` utils alias, and rewriting them would have to be repeated on
  every `shadcn add`. `lib/utils.ts` re-exports from the same package instead.
- Dark mode follows the system preference through a pre-paint inline script, because
  the shadcn tokens key off a class the server cannot know.

## Validation

On Windows with Node 25.2.1: `npm run check` passed end to end — harness build, both
typechecks, console lint, 71 harness tests, 14 console tests, and the console build.

The console was also opened in Chrome against a production build. At a 413px
effective viewport there was no horizontal overflow with the sheet closed or open,
the desktop sidebar was hidden, the mobile header was shown, the menu button and
sheet links measured 44px, Escape closed the sheet, focus returned to the trigger,
the active link carried `aria-current="page"`, and the navigation landmark was
labelled. Dark mode applied from the system preference.

This was a manual pass at one width in one browser. Other breakpoints, other
browsers, Linux, Node 24, and automated accessibility coverage remain untested, and
nothing has been deployed.

## Corrections and blockers

The browser extension's window resize reported success but left the viewport
unchanged across three attempts, so the narrow layout was measured inside a 428px
iframe, which has its own viewport for media queries. That workaround is worth
knowing for the QA phase; Playwright controls viewport directly and should be used
there instead.

The browser pass found two real defects, both fixed: the menu button was 32 x 32 px,
smaller than a comfortable touch target, and the marker on unbuilt sections showed a
bare number that read as an item count rather than a phase. Neither would have been
caught by the test suite.

A navigation test asserted that a Lucide icon is a function; in this version they are
`forwardRef` objects, so the assertion was wrong and was corrected.

No unresolved test failures or Phase 8 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 9: the architecture and workflow visualizations with React Flow,
verifying its version at implementation time. Nodes must be non-editable, both
diagrams must be built from the real definitions rather than a hand-drawn graph, they
must stay usable at narrow widths, and they must offer an accessible text alternative
so the content does not depend on the canvas. Continue the remaining phases in
`docs/implementation-plan.md` with scoped commits.

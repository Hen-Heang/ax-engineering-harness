# Phase 9 handoff

Goal: add the architecture and workflow visualizations, built from real definitions
rather than drawn by hand, read-only, and with a text alternative so the content does
not depend on the canvas.

Status: complete for Phase 9. The configuration explorer, the building-block pages,
the adoption simulator, and the quality, evals and runs pages remain unimplemented.

## Completed

Added the architecture schema, the architecture map definition, and a registry that
validates it against the real roles, procedures, capabilities and definitions it
references. Added React Flow 12.11.6 and a read-only graph view with node detail and
a full text alternative, plus the architecture and workflow pages, and enabled their
navigation entries. Split the web graph module so client components cannot reach the
harness package, and extended the boundary test to follow imports transitively. No
legacy project files changed.

Changed areas: `harness/` (architecture schema, definition, core, index, tests),
`apps/web/` (lib, components, app, tests, package.json), `package-lock.json`,
`README.md`, and `docs/`.

## Decisions

- The architecture map is a harness contract, not a graph in the web application, so
  the registry can reject a map naming something the harness does not define.
- Node positions are declared as `row` and `column`, which avoids a layout engine and
  keeps the map reviewable as data.
- `fitView` is clamped at 0.75 because a twelve-state lifecycle cannot fit a viewport
  legibly, and reading a node matters more than seeing the whole shape at once.
- The text alternative is always visible, not hidden behind assistive technology.
- `lib/graph-types.ts` holds shapes and pure helpers for client components;
  `lib/graph.ts` builds graphs on the server.

## Validation

On Windows with Node 25.2.1: `npm run check` passed end to end — harness build, both
typechecks, console lint, 76 harness tests, 24 console tests, and the console build.

Both pages were opened in Chrome against a production build. The architecture map
renders 16 nodes; selecting one shows its detail and the real source of the definition
it references, and nodes are not draggable. The workflow page renders 12 states with
30 edge paths, of which 4 are dashed failure paths labelled "on failure", matching the
4 states that declare `onFailure`. At a 413px viewport there was no horizontal
overflow and the text alternative listed every node.

Other breakpoints, other browsers, Linux, Node 24, and automated accessibility
coverage remain untested, and nothing has been deployed.

## Corrections and blockers

The build failed the first time the diagram component was written, because a client
component imported `lib/graph.ts`, which imports `@ax-harness/core`, which reaches
the filesystem. Turbopack refused to bundle `node:fs/promises` for the browser. The
Phase 7 boundary test scanned direct references only and would not have caught this,
so the module was split and the test now follows local imports transitively from every
client component.

The browser pass found two defects the tests could not see. React Flow's
`colorMode="system"` resolved to light on a dark page, so the diagram now follows the
same `dark` class as the rest of the console, watched with a `MutationObserver`. And
`fitView` zoomed to 1.6x rather than fitting, because it measured nodes before they
had dimensions; nodes now declare an explicit width and height.

A stray line-number artifact was pasted into the graph component while writing it and
was removed before building.

The browser tab returned to `/` twice after an in-page iframe probe was removed. That
is an automation artifact rather than application behaviour; direct navigation to each
page rendered correctly every time.

No unresolved test failures or Phase 9 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 10: the profiles, agents, skills, MCP/tools and policies pages, and
the configuration explorer. Every page renders from the catalog with status badges
from each definition. The explorer shows a definition's real source and reaches
nothing outside the allowlist: a file tree in the UI is a view of the catalog, never
of the filesystem. Continue the remaining phases in `docs/implementation-plan.md` with
scoped commits.

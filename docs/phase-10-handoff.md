# Phase 10 handoff

Goal: add the building-block pages and the configuration explorer, every one of them
rendering from the catalog rather than from prose, and reaching nothing outside the
allowlist.

Status: complete for Phase 10. The quality, evals, runs, projects and docs pages and
the adoption simulator remain unimplemented.

## Completed

Added `lib/definitions.ts`, which turns a definition into the labelled sections every
page renders. Added the profiles, agents, skills, MCP and tools, and policies pages,
the capability matrix, and the configuration explorer with one statically generated
page per definition. Added shared presentational components and seven tests for the
detail model. Enabled six navigation entries and added a Config explorer entry. No
legacy project files changed.

Changed areas: `apps/web/` (lib, components, app, tests), `README.md`, and `docs/`.

## Decisions

- Pages read the definition instead of restating it, so a definition that gains a
  limitation shows it without anyone editing a page.
- List pages expand with native `details`/`summary`, so expansion works with the
  keyboard, works before hydration, and ships no client JavaScript.
- The explorer is one static page per definition with parameters taken from the
  catalog, so a route cannot exist for something the allowlist does not expose. The
  tree is a view of the catalog, never of a filesystem.
- The boundary test now ignores type-only imports, which TypeScript erases and which
  therefore cannot pull a filesystem module into the bundle.
- The navigation gained a Config explorer entry, and its test was updated to match the
  sections the console actually has.

## Validation

On Windows with Node 25.2.1: `npm run check` passed end to end — harness build, both
typechecks, console lint, 76 harness tests, 31 console tests, and the console build,
which now emits 10 routes including 29 statically generated explorer pages.

All new pages were opened in Chrome against a production build. The policies matrix
renders 14 capabilities across 8 roles with the five denials showing as denied to
every role. The explorer renders the tree, the derived sections, and the real source.
At a 413px viewport, the profiles, agents, skills, tools and explorer pages have no
horizontal overflow, and the policies page has none after the fix below.

Other breakpoints, other browsers, Linux, Node 24, and automated accessibility
coverage remain untested, and nothing has been deployed.

## Corrections and blockers

The policies page scrolled sideways by 308px at 428px even though the capability
table sat inside an `overflow-x-auto` container that was correctly clipping it.
Neither `min-w-0`, `max-w-full`, nor `overflow-x: clip` on an ancestor changed
anything, because the ancestors were not the problem. Every cell carries an `sr-only`
label, and Tailwind's `sr-only` is `position: absolute`; with no positioned ancestor
inside the scroller those 113 elements resolved their containing block to the initial
one, escaped the scroller's clipping, and extended the document to the table's full
width. Adding `relative` to the scroll container contained them. The class is
load-bearing and is commented as such, and every label was kept.

The boundary test initially failed on `capability-matrix.tsx`, which imports only a
type from the harness. The test could not tell a type-only import from a runtime one;
it now strips them first. That correction also revealed that `lib/definitions.ts`
takes only types from the harness, so the runtime surface is two modules rather than
three.

Two authoring slips were corrected during the phase: a heredoc could not carry the
JSX for two pages, which were written with the editor instead, and a JSX comment
placed before the root element produced two sibling roots and failed the build.

No unresolved test failures or Phase 10 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 11: the quality gates, evals, runs, projects and docs pages. Gate
results must keep passed, failed, unavailable and unrun distinct on screen as well as
in the model, and every demo record must be labelled where it is displayed. The
adoption simulator may run from static validated configuration and must not imply that
anything executes. Continue the remaining phases in `docs/implementation-plan.md` with
scoped commits.

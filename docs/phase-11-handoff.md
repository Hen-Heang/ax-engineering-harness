# Phase 11 handoff

Goal: add the quality, evals, runs, adoption and docs pages, keeping the four gate
outcomes distinct on screen and labelling every illustrative record where it is
displayed.

Status: complete for Phase 11. Every navigation entry now has a page. Systematic
accessibility and responsive QA remains, and is the last phase.

## Completed

Added `lib/simulation.ts`, which derives gate views, per-profile gate support, the
stack simulations, and example eval outcomes scored by the harness's own scorer.
Added the quality gates, evals, runs, projects and docs pages, an outcome badge, an
example notice, and the client-side stack simulator. Enabled the last five navigation
entries and added nine tests. No legacy project files changed.

Changed areas: `apps/web/` (lib, components, app, tests), `README.md`, and `docs/`.

## Decisions

- Example eval outcomes are computed by the real scorer over example judgements, so
  the page demonstrates the actual rules. One example shows a full score that still
  fails, because forbidden behaviour is disqualifying rather than a deduction.
- Illustrative content is labelled where it appears, not once in a footnote, so a
  screenshot cannot misrepresent it.
- Gate outcomes always show the word, so passed and unrun are never distinguished by
  colour alone.
- The simulator states what does not change as prominently as what does: only the
  profile layer varies by stack, and pretending roles differ per stack would have been
  an easy but dishonest demo.
- The docs page links topics to console pages and names the authoritative repository
  document rather than reading Markdown from disk, which would need filesystem access
  the console deliberately does not have.
- The navigation test asserting that unbuilt sections exist was replaced once every
  section landed, rather than left to pass vacuously.

## Validation

On Windows with Node 25.2.1: `npm run check` passed end to end — harness build, both
typechecks, console lint, 76 harness tests, 39 console tests, and the console build,
which now emits 15 routes including the 29 generated explorer pages.

The new pages were opened in Chrome against a production build. The runs page labels
its record as an example twice and reports integration tests as unavailable rather
than passed. The evals page shows 100% pass, 70% fail with the unjudged criteria
named, and 100% fail on forbidden behaviour. The simulator's three stack buttons are
44px, toggle `aria-pressed` correctly, and switching to the composed stack shows both
areas with the roles the definition assigns them. The policies page still does not
scroll sideways at a 413px viewport, with all 14 capability rows present.

Other breakpoints, other browsers, Linux, Node 24, and automated accessibility
coverage remain untested, and nothing has been deployed. Phase 12 addresses that.

## Corrections and blockers

`capability-matrix.tsx` was found rewritten on disk: `min-w-[46rem]` had been
normalised to `min-w-184`, which is the same 46rem on the Tailwind v4 spacing scale,
and `last:border-b-0` had been dropped. The normalisation was left alone; the row
border was restored, because losing it doubles the border under the final row.
Something in this workspace appears to reformat Tailwind arbitrary values on save,
which is worth knowing before attributing such a diff to a deliberate edit.

No unresolved test failures or Phase 11 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 12: verify the console systematically rather than by sampling.
Accessibility and responsive behaviour at desktop, tablet, 428px and a narrower width,
across every page, with automated coverage that runs in the repository's own checks.
Address what it finds, keep the harness checks passing unchanged, and record honestly
what remains untested, including platforms and browsers that were not exercised.

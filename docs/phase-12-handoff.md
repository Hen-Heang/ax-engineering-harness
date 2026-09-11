# Phase 12 handoff

Goal: verify the console systematically rather than by sampling, with automated
accessibility and responsive coverage that runs in the repository's own checks, and
fix what it finds.

Status: complete for Phase 12, and with it every planned phase. Execution — running
gates, connecting tools, recording real runs, enforcing policy — remains unbuilt.

## Completed

Added Playwright 1.63.0 and axe 4.13.0, a Playwright configuration with four viewport
projects, and four spec files covering every page. Wired the suite into `npm run
check`, and enabled the integration-test gate in the repository's own declaration with
`npm run e2e`. Fixed the two accessibility defects the suite found. No legacy project
files changed.

Changed areas: `apps/web/` (playwright config, e2e specs, components, evals page,
package.json), `.ax/project.yaml`, root `package.json`, `package-lock.json`,
`README.md`, and `docs/`.

## Decisions

- The browser suite runs inside `check` rather than beside it, and the repository's
  declaration now enables the integration-test gate. A check the repository does not
  run is not a check it has.
- A missing Chromium fails the suite rather than skipping it, applying the project's
  own rule that an unavailable check is not a passing one to the project itself.
- Which specs run at which width is set in the configuration rather than by skipping
  at runtime, so nothing reports as skipped when it simply does not apply.
- axe is described as finding a real subset of problems. Passing is stated as "no
  automatically detectable violation", never as "accessible".
- Only Chromium is installed; Firefox and WebKit are named as unverified.

## Validation

On Windows with Node 25.2.1, `npm run check` passed end to end: harness build, both
typechecks, console lint, 76 harness tests, 39 console tests, the console build, and
238 browser tests across four viewport projects, in about two and a half minutes.

Every page is checked at 1440, 768, 428 and 360 CSS pixels for horizontal overflow,
for wide content escaping its scroll container, and for a single `main` landmark and
`h1`. Accessibility is checked with axe against WCAG 2.0 and 2.1 A and AA at the
widest and narrowest sizes. Navigation, the sheet, Escape handling, focus return,
touch-target sizes, keyboard expansion of a definition list, and keyboard operation of
the adoption simulator are all exercised.

`npm run ax -- quality` now reports eight applicable gates, all unrun, with
`integration_tests` ready and bound to `npm run e2e`.

Unverified: Firefox, WebKit, Linux, macOS, the recommended Node 24 runtime, and manual
assistive-technology testing. Nothing has been deployed, and no gate, agent or
evaluation has been executed by the harness itself.

## Corrections and blockers

The suite found two real defects, both fixed. Every source block and the capability
matrix container scrolled with a pointer but could not be focused, so a keyboard user
could not read past the first screenful; they are now focusable and named. The failure
badge used the generator's tinted destructive variant, `bg-destructive/10` with
`text-destructive`, which falls below the contrast minimum on this surface; a failure
is the one outcome that must never be hard to read, so it is now solid.

A partial `.next` directory caused a confusing "no production build" error. The cause
was that `next build` type-checks the end-to-end specs, and an incorrect `test.skip`
signature failed that step, leaving the directory half-written. Expressing the viewport
matrix in the configuration removed the runtime skips entirely.

Enabling the integration-test gate changed what two harness tests should expect. They
were updated to match the declaration, as in Phase 7, rather than the reverse.

No unresolved failures. Distribution licensing remains undecided and does not block
local development.

## Next steps

Every planned phase is implemented, so the next work is not a phase but a capability:
a controlled execution layer that can run a declared gate, record a real run, and
enforce policy at the point of access. When it exists, the run schema's refusal of a
`recorded` record should be removed deliberately, and the README, the console and the
run page updated together so that no page claims an execution the harness cannot make.

Before any public deployment, the undecided distribution licence must be settled, and
the console's claim that it publishes nothing from the preserved legacy projects should
be re-checked against whatever hosting is chosen.

# Phase 7 handoff

Goal: add `apps/web` as a second workspace package and give it a catalog built from
the real harness definitions, so the console cannot drift from the harness and
cannot reach anything it is not explicitly allowed to show.

Status: complete for Phase 7. Navigation, diagrams, the configuration explorer, the
building-block pages, and the adoption simulator remain unimplemented.

## Completed

Added the `@ax-harness/web` workspace with Next.js 16 App Router, React 19, Tailwind
v4, TypeScript and ESLint. Added `lib/catalog.ts`, the allowlist that turns the
registries into displayable entries, and a foundation page that renders it. Added
catalog and safety tests, including a scan that fails if any shipped file references
a filesystem API. Root scripts now cover both packages, `.ax/project.yaml` declares
and enables the lint gate, and the lockfile was regenerated cleanly. No legacy
project files changed.

Changed areas: `apps/web/` (new), root `package.json`, `package-lock.json`,
`.gitignore`, `.ax/project.yaml`, two harness tests, `README.md`, and `docs/`.

## Decisions

- Versions were checked against the registry rather than assumed. TypeScript 7.0.2
  and ESLint 10.10.0 were deliberately not taken: the harness is pinned to
  TypeScript 5.9.3, and `eslint-config-next@16.3.4` depends on ESLint 9.39.5, so
  taking the newer majors produced two compilers and two linters in one workspace.
- The catalog is the allowlist. It imports only pure data and pure functions, and
  displayed source is serialized from the loaded definition rather than read from a
  path, so no request can influence a file path.
- The filesystem boundary is enforced by a test that scans shipped files, not by
  documentation alone. Comments are stripped first, so prose may name the forbidden
  APIs while code may not.
- Dependencies are added in the phase that renders them, so shadcn primitives,
  Lucide and React Flow are not installed yet.
- Enabling the lint gate changed what three harness tests should expect. The tests
  were updated to match the declaration, not the other way round.

## Validation

On Windows with Node 25.2.1: `npm run check` passed end to end — harness build,
both typechecks, console lint, 71 harness tests, 8 console tests, and the console
build. The build prerendered the page statically, and the emitted HTML reports 29
definitions, matching the registries exactly, which confirms the page renders real
data rather than a hand-written list. Installation reported 0 vulnerabilities.
`git add -n` confirmed only 11 source files are added under `apps/`, with no build
artifact or dependency directory. `git diff --name-only` over the four preserved
project trees was empty.

Linux, Node 24, legacy builds, browser rendering, accessibility, and responsive
behavior remain untested; the console has only been built and prerendered, never
opened in a browser. Nothing has been deployed.

## Corrections and blockers

Pinning ESLint 10.10.0 while `eslint-config-next` depended on 9.39.5 installed both,
leaving plugins loaded against a different ESLint than the runner. Editing the pin
was not enough because the lockfile kept a stale nested entry, so the lockfile was
regenerated from scratch, after which a single ESLint version resolves.

Next rewrote `apps/web/tsconfig.json` during its first build, setting `jsx` to
`react-jsx` and adding `allowJs` and a dev types path. That is its mandatory
reconfiguration and was kept rather than reverted.

A scripted README edit using nested here-documents, and a test edit containing
regular-expression escapes, were both corrupted in transit and were reapplied with
a single script and the editor respectively.

No unresolved test failures or Phase 7 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 8: persistent console navigation and the Overview page. The sidebar
must become a sheet on mobile with no horizontal overflow, visible focus, and
accessible tap targets. Use shadcn primitives rather than rebuilding them, and
install only what is rendered. Status labels must come from the status each
definition declares rather than a hand-maintained list. Continue the remaining
phases in `docs/implementation-plan.md` with scoped commits.

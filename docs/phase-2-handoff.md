# Phase 2 handoff

Goal: establish a vendor-neutral configuration foundation without changing the
existing Java projects.

Status: complete for Phase 2; the overall Harness and web showcase remain in progress.

## Completed

Added an isolated npm workspace, project schema, generated types, YAML loader,
semantic validator, context-reference checks, CLI, and automated tests. Root
instructions define preservation boundaries. README describes actual functionality;
HISTORY.md preserves the old README. No legacy project files were changed.

Changed areas: root tooling/README/instructions, `.ax/project.yaml`, `harness/`,
and `docs/`. See the phase commit for the exact file manifest.

## Decisions

- JSON Schema draft-07 is authoritative; tests detect generated-type drift.
- Node test runner plus tsx keeps this library independent of a web framework.
- Context checking only inspects paths and metadata; commands are never executed.
- Profile identifiers are syntax-only until Phase 3; `harness-tooling` needs an
  actual definition when profile resolution is introduced.
- Dangerous capabilities cannot be enabled by v1 configuration. Runtime policy
  enforcement is not implemented.

## Validation

On Windows with Node 25.2.1: typecheck passed, 13 tests passed, package build passed,
CLI validation passed, and importing the compiled workspace package passed.
`git diff --check` passed. Dependency installation reported zero vulnerabilities.
The recommended Node 24 runtime and Linux have not yet been tested here.
Legacy builds/tests, web lint, browser testing, and production deployment were not run.

## Corrections and blockers

A declaration-only generated source would not have shipped its types through the
TypeScript build. Generation now produces a `.ts` source, so emitted declarations
are available to consumers. No unresolved test failures or Phase 2 blockers.
Distribution licensing remains undecided and does not block local development.

## Next steps

Implement Phase 3's profile schema, Java/Spring definition and explicit profile
resolution, with Maven/Gradle ambiguity handling, Windows commands, and tests.
Do not resolve ambiguity by editing or running existing legacy projects. Continue
the remaining phases in `docs/implementation-plan.md` with scoped commits.

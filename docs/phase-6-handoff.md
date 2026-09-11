# Phase 6 handoff

Goal: add the Next.js/React profile and full-stack composition, supplying only what
a project genuinely has and determining affected areas without inventing parallel
agent execution.

Status: complete for Phase 6. The web console, gate execution, MCP connections, and
real runs remain unimplemented.

## Completed

Extended the profile contract with optional supporting `evidence` and composed
`areas`, making `buildSystems` optional so a profile declares one or the other.
Added the `nextjs-react` and `fullstack` profiles. Extended resolution to resolve
each area of a composed profile in its own directory with its own runner, and to
report evidence. Added `analyzeImpact` for affected-area analysis. Updated the CLI
to print areas and evidence. No legacy project files changed.

Changed areas: `harness/` (profile schema, profiles, core/buildsystem,
core/profiles, cli, tests), `README.md`, and `docs/`.

## Decisions

- The Next.js profile was written from the current Next.js documentation, which
  changed it: `next lint` is gone from the CLI, a linter is optional in
  create-next-app, and no typecheck or test script is scaffolded. It therefore
  supplies only build and security, and never assumes Playwright.
- Supporting evidence is reported and never acted on. It cannot select a build
  system or cause a failure, because its absence disproves nothing.
- A profile declares either build systems or areas, enforced at load, and
  composition is one level deep.
- A composed project has no single build root, so `buildSystem` and `runner` are
  undefined for the project and `project.build_system` is rejected rather than
  applied to an arbitrary area.
- `fullstack` supplies no commands, because no single command covers two build
  systems and inventing one would be dishonest.
- Affected-area analysis is path analysis, reports unattributed paths rather than
  dropping them, and starts nothing.

## Validation

On Windows with Node 25.2.1: typecheck passed, 71 tests passed (61 from Phase 5
plus 10 new), and the package build passed. A temporary composed repository was
resolved end to end through the CLI: the backend area resolved `java-spring`/maven
selecting `mvnw.cmd` for Windows, the frontend area resolved `nextjs-react`/node
with an unverified `npm` fallback, and both declared commands were attributed to
the project. `git diff --check` passed and `git diff --name-only` over the four
preserved project trees was empty.

Linux, Node 24, legacy builds, and deployment remain untested. No command, gate,
agent, or lifecycle transition has been executed. The `nextjs-react` profile has
not been validated against a real Next.js repository, only against fixtures.

## Corrections and blockers

Making `buildSystems` optional broke `ResolvedProject`, which had assumed one build
system and one runner per project. Both became optional rather than being faked for
composed profiles, and the CLI and `ax quality` label were updated to match.

An attempt to update the README through nested shell here-documents corrupted the
command; the edit was reapplied with a single script.

No unresolved test failures or Phase 6 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 7: `apps/web` as a second workspace package, rendering from an
explicit allowlisted catalog built from the real definitions so documentation
cannot drift. Verify compatible stable versions at implementation time. The browser
must never receive arbitrary filesystem or server capability, and no local run
artifact, legacy project file, or credential may be published. Continue the
remaining phases in `docs/implementation-plan.md` with scoped commits.

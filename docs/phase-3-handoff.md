# Phase 3 handoff

Goal: give profiles real meaning. Replace Phase 2's syntax-only profile identifier
with a versioned profile contract, a built-in registry, build-system detection, and
resolution that supplies defaults without weakening existing guarantees.

Status: complete for Phase 3. Agents, skills, policies, quality execution, evals,
runs, and the web console remain unimplemented.

## Completed

Added `harness/schemas/profile.schema.json` with generated types, the
`java-spring` and `harness-tooling` definitions, an explicit registry, Maven /
Gradle / Node detection with Windows and POSIX runner forms, and profile
resolution. Split validation into declaration-time and post-resolution layers.
Added `project.build_system` as an optional selector for ambiguous roots. The CLI
now reports the resolved profile, build system, runner availability, and the
source of every command. No legacy project files were changed.

Changed areas: `harness/` (schemas, config, core, cli, profiles, tests),
`.ax/project.yaml`, `README.md`, and `docs/`.

## Decisions

- Declaration validation omits the gate-command rule; the full rule runs on the
  resolved configuration. The guarantee moved to where the answer is known, and
  `validateProject` itself is unchanged in strictness.
- Profile definitions are JSON imported statically, which ships through the
  existing TypeScript build and keeps identifiers out of path construction.
- The registry validates built-in definitions at module load, so a malformed
  profile fails loudly rather than resolving into a project.
- Resolution writes only into `commands`; other sections are copied verbatim, so
  a profile structurally cannot relax permissions or enable a gate.
- Detection never recurses. This repository contains nested unrelated projects,
  and a recursive scan would produce wrong answers inside `spring-boot-lab`.
- Ambiguous manifests fail. `project.build_system` is the explicit escape hatch.
- `java-spring` supplies build and test only; lint, typecheck, security and
  integration-test defaults were omitted rather than guessed.

## Validation

On Windows with Node 25.2.1: typecheck passed, 29 tests passed (13 from Phase 2
plus 16 new), the package build passed, the CLI resolved this repository against
`harness-tooling`, and importing the compiled package resolved a project through
`dist`, confirming profile JSON and generated declarations ship. `git diff --check`
passed and `git diff --name-only` over the four preserved project trees was empty.

The recommended Node 24 runtime and Linux remain untested here. Legacy builds and
tests, web lint, browser testing, and deployment were not run. No command that a
profile resolves has ever been executed.

## Corrections and blockers

Profile command arguments are constrained to whitespace-free tokens so that
joining them is unambiguous. A command needing quotes must be declared by the
project instead; this is documented rather than worked around.

The first attempt wrote schema files through a shell heredoc, which mangled
regular-expression backslashes. Files containing escapes are now written directly.

No unresolved test failures or Phase 3 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 4: the eight agent roles and ten procedural skills as versioned
data with a schema, registry and tests, the permission/capability matrix, and the
Codex and Claude adapters. Definitions must not imply that any agent executes.
Continue the remaining phases in `docs/implementation-plan.md` with scoped commits.

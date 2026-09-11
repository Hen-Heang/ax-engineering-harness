# Implementation plan

The user approved the Phase 1 architecture on 2026-09-11. Work proceeds in
bounded phases, inspecting existing code and verifying each change before the next.

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | Repository audit and architecture | Complete |
| 2 | Core package, project schema, validator, context checks, tests | Implemented |
| 3 | Java/Spring profile and resolution | Implemented |
| 4 | Agents, procedural skills, policies, vendor adapters | Next |
| 5 | Quality, workflow, eval, run and handoff foundations | Planned |
| 6 | Next.js and full-stack profiles | Planned |
| 7 | Next.js web package and safe catalog | Planned |
| 8 | Overview and responsive console navigation | Planned |
| 9 | Architecture and workflow visualizations | Planned |
| 10 | Building-block pages and Config Explorer | Planned |
| 11 | Quality, evals, example runs, adoption simulator, docs | Planned |
| 12 | Integrated tests, accessibility, responsive QA | Planned |

## Phase 2 decisions

- npm workspaces include only `harness` until the web package exists.
- JSON Schema is the source of generated TypeScript configuration declarations.
- Use Node's test runner with tsx for this small library, rather than introducing
  a web-oriented test runner before the web package exists.
- No empty profile or integration directories implying working functionality.
- Reposition README now and preserve the original content in HISTORY.md so the
  repository explains its actual incremental status from the first implementation.

## Phase 3 decisions

- Validation splits into declaration-time and post-resolution layers.
  `validateDeclaration` omits the gate-command rule so a profile can still supply
  defaults; `validateProject` keeps the full rule and runs on the resolved
  configuration, so the Phase 2 guarantee moved rather than weakened.
- Profile definitions are JSON imported statically by an explicit registry. JSON
  already ships through the TypeScript build the way schemas do, so no asset
  copying step is needed, and profile identifiers never become filesystem paths.
- Built-in definitions are schema-validated when the registry module loads, so a
  malformed profile fails immediately instead of resolving into a project.
- Resolution writes only into `commands`. Every other section is copied verbatim,
  which makes "a profile cannot relax policy" structural rather than a convention.
- Detection reads manifests directly in one selected root and never recurses,
  because nested unrelated projects exist in this repository.
- `project.build_system` was added as an optional selector for ambiguous roots.
  Ambiguity fails by default; it is never resolved by choosing arbitrarily.
- `java-spring` supplies build and test only. Lint, typecheck, security, and
  integration-test defaults were deliberately omitted: Java has no single standard
  command for them, and neither Maven failsafe nor a Gradle `integrationTest` task
  is guaranteed to be configured in an arbitrary project.
- Profile command arguments are whitespace-free tokens joined with single spaces,
  so resolution never needs to quote or escape.

## Phase 4 acceptance criteria

Define the eight agent roles and ten procedural skills as versioned data with the
same treatment profiles received: a schema, a registry, tests, and explicit status
labels. Add the permission/capability matrix that policies express, and the Codex
and Claude adapters as translations of shared instructions rather than competing
architectures. Definitions must not imply that any agent executes.

## Verification

Run `npm run check`, the CLI, and generated-type drift verification. Legacy
projects are excluded from workspace builds and tests. Later web phases add lint,
unit/UI testing and Playwright at desktop, tablet, 428px and narrower mobile sizes.

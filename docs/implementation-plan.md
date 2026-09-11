# Implementation plan

The user approved the Phase 1 architecture on 2026-09-11. Work proceeds in
bounded phases, inspecting existing code and verifying each change before the next.

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | Repository audit and architecture | Complete |
| 2 | Core package, project schema, validator, context checks, tests | Implemented |
| 3 | Java/Spring profile and resolution | Implemented |
| 4 | Agents, procedural skills, policies, vendor adapters | Implemented |
| 5 | Quality, workflow, eval, run and handoff foundations | Implemented |
| 6 | Next.js and full-stack profiles | Implemented |
| 7 | Next.js web package and safe catalog | Implemented |
| 8 | Overview and responsive console navigation | Next |
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

## Phase 4 decisions

- Roles, procedures, capabilities and adapters are versioned data under their own
  schemas, treated exactly as profiles were, rather than prose in documentation.
- One capability vocabulary serves agents and skills, so the permission matrix is
  derived from the definitions instead of being maintained separately.
- The five capabilities denied to every role reuse the identifiers of the five
  permissions the project schema forces to `false`, and a test asserts the two sets
  are identical. The policy and configuration contracts cannot drift apart.
- Each capability names the project tool it depends on, so the tools a role needs
  follow from its capabilities rather than being listed twice.
- The registry refuses to load definitions that contradict each other: an unknown
  skill, an unknown or denied capability, or a role listing a procedure whose
  capabilities it does not hold. The guard is a pure exported function so that the
  guard itself is tested, not merely assumed.
- Type generation loops over `schemas/*.json`, so a new schema automatically gets
  a generated declaration and drift coverage.
- `ax policy` prints the matrix from the definitions, which keeps the data honest
  by making it visible, and states in its own output that nothing enforces it.
- Every role and procedure is labelled experimental. The definitions are real; no
  runner exists, and none is implied by defining eight roles.

## Phase 5 decisions

- Readiness and outcome are separate ideas. `ready`, `unavailable`, `manual` and
  `not-applicable` say whether a gate can be attempted; `passed`, `failed`,
  `unavailable` and `unrun` say what happened. Being ready is not having passed.
- A gate the project disabled is absent from the results rather than counted, and
  `pipelinePassed` returns false for an empty pipeline, so a configuration that
  gates nothing cannot report success by default.
- `planQuality` keeps the `unavailable` branch even though resolution already
  rejects an enabled gate with no command. The model must be able to express a gate
  nobody could run, and the branch is tested directly.
- A rejected human approval returns to `plan`, not `implement`. If a person rejects
  the change, re-implementing the same plan would waste the rejection.
- A failure path is bounded by `limits.max_retries`, so `max_retries: 0` forbids a
  failure path entirely and an exhausted budget stops rather than looping.
- Eval scoring treats a missing criterion as zero and reports it, so a response
  cannot reach the threshold by omission; forbidden behavior is disqualifying
  rather than a deduction.
- `validateRunRecord` rejects `kind: "recorded"` outright, because no component in
  this build can execute a run, so such a record could only be fabricated. That
  check is removed deliberately when execution exists, not before.
- Token and cost fields are optional and omitted when unmeasured. An absent
  measurement means unmeasured, never zero, and callers ask `isMeasured`.
- Handoff records require `blockers` and `failedAttempts` as keys, so an empty list
  is an explicit claim rather than a silent omission.
- The written-handoff checker runs over this repository's own phase handoffs, so
  the project is held to the contract it publishes.

## Phase 6 decisions

- The Next.js profile was written from the current Next.js documentation rather
  than from assumption, and that changed it. `next lint` is absent from the current
  CLI; a linter is optional in create-next-app, which offers ESLint, Biome or none;
  and no typecheck or test script is scaffolded. The profile therefore supplies only
  build and security, and records the `next typegen && tsc --noEmit` pattern as
  guidance rather than as a default.
- Profiles gained optional supporting `evidence` (such as `next.config.ts`). It is
  reported and never acted on: it cannot select a build system and cannot cause a
  failure, because its absence disproves nothing. It exists so a reader can judge
  confidence instead of being told a manifest proves a framework.
- A profile declares either `buildSystems` or `areas`, never both, enforced when
  the registry loads. Composition is one level deep, so a composed profile cannot
  compose another.
- A composed project has no single build root, so `buildSystem` and `runner` are
  undefined for the project as a whole and `project.build_system` is rejected rather
  than silently applied to one area.
- `fullstack` supplies no commands at all. No single command covers two build
  systems, so inventing one would be dishonest; the project declares its own.
- Affected-area analysis is path analysis and says so. It reports unattributed paths
  rather than dropping them, and reaching an area's directory is not proof that
  another area's behavior is unaffected.
- Determining affected areas decides which roles are involved. It starts nothing,
  and no parallel agent execution is implied or provided.

## Phase 7 decisions

- Versions were checked against the registry at implementation time. Two published
  latest versions were deliberately not taken: TypeScript 7.0.2, because the harness
  is pinned to 5.9.3 and two compilers in one workspace make differences hard to
  attribute; and ESLint 10.10.0, because `eslint-config-next@16.3.4` depends on
  ESLint 9.39.5 directly, and installing 10 produced two copies with plugins loaded
  against a different one than the runner.
- `apps/web/lib/catalog.ts` is the allowlist. A definition not turned into an entry
  there cannot reach the browser, and the catalog imports only pure data and pure
  functions, never the loader, resolver, context checker, or detection helpers.
- Displayed source is serialized from the loaded definition rather than read from a
  path, so there is no file path for a request to influence.
- A test scans every shipped file under `app/` and `lib/` for filesystem APIs, so
  the boundary is enforced rather than merely documented. Comments are stripped
  before scanning, so prose may discuss the forbidden APIs while code may not.
- Dependencies are added in the phase that uses them. shadcn primitives, Lucide and
  React Flow are not installed yet, because nothing yet renders them.
- The repository's own declaration now enables the lint gate and declares
  `npm run lint`, because the console brings the repository its first linter. Three
  harness tests were updated to match the declaration rather than the reverse.
- Root `build`, `typecheck` and `test` now cover both packages, so `.ax/project.yaml`
  stays truthful about the whole repository.

## Phase 8 acceptance criteria

Add the persistent console navigation and the Overview page. The sidebar must
become a sheet on mobile with no horizontal overflow, visible focus, and accessible
tap targets. Use shadcn primitives rather than rebuilding them, and install only
what is rendered. The Overview must state the Experimental status honestly, show the
mental model, and distinguish Implemented, Experimental and Planned using the status
each definition actually declares rather than a hand-maintained list.

## Verification

Run `npm run check`, the CLI, and generated-type drift verification. Legacy
projects are excluded from workspace builds and tests. Later web phases add lint,
unit/UI testing and Playwright at desktop, tablet, 428px and narrower mobile sizes.

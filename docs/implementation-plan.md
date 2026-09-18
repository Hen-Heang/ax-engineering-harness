# Implementation plan

Controlled execution roadmap: Phases 0–3 implemented through local run persistence;
policy authorization, doctor, init, real Spring validation, and later integrations
remain planned. The original twelve-phase foundation below remains historical context.

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
| 8 | Overview and responsive console navigation | Implemented |
| 9 | Architecture and workflow visualizations | Implemented |
| 10 | Building-block pages and Config Explorer | Implemented |
| 11 | Quality, evals, example runs, adoption simulator, docs | Implemented |
| 12 | Integrated tests, accessibility, responsive QA | Implemented |

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

## Phase 8 decisions

- The navigation lists every planned section from the start, but an item whose page
  does not exist carries no href and is rendered as text with a phase marker. A test
  asserts every href resolves to a real page file, so a link cannot precede a page.
- Status labels are derived by `statusBreakdown` from the status each definition
  declares, so no page holds a hand-maintained maturity list.
- The shadcn generator's choices were corrected where they conflicted with this
  repository: caret ranges were pinned to exact versions, the CLI was kept as a
  dependency only because `globals.css` imports `shadcn/tailwind.css`, and `clsx`
  and `tailwind-merge` were dropped once nothing imported them directly.
- The generated components import `cn` from the published package rather than from
  the `components.json` utils alias. Rewriting every generated component would have
  to be repeated on each `shadcn add`, so `lib/utils.ts` re-exports from the same
  package instead, leaving one implementation behind both import paths.
- Dark mode follows the system preference through a pre-paint inline script, because
  the shadcn tokens key off a class the server cannot know. A toggle can come later.
- Responsive behavior was measured in a browser rather than assumed. The extension's
  window resize had no effect here, so the narrow layout was measured inside a 428px
  iframe, which has its own viewport for media queries.

## Phase 9 decisions

- The architecture map became a versioned harness contract rather than a graph drawn
  in the web application, so its nodes can reference real roles, procedures and
  capabilities and the registry can refuse a map that names something the harness
  does not define. A diagram that can drift from the system it describes is worse
  than none, because it is believed.
- Node positions are declared as `row` and `column` and centred by the renderer,
  which avoids a layout engine and keeps the map reviewable as data.
- `fitView` is clamped so it cannot zoom below 0.75. A twelve-state lifecycle does
  not fit a viewport at a legible size, and reading a node matters more than seeing
  the whole shape at once; the text list carries the rest.
- The text alternative is always visible rather than hidden behind assistive
  technology, so the content never depends on the canvas.
- Client and server were separated explicitly after the build refused a client
  component that reached `@ax-harness/core`. `lib/graph-types.ts` holds shapes and
  pure helpers for the client; `lib/graph.ts` builds graphs on the server.
- The Phase 7 boundary test scanned direct references only. It now follows local
  imports transitively from every client component, and asserts that the only modules
  importing the harness are `lib/catalog.ts` and `lib/graph.ts`.

## Phase 10 decisions

- `lib/definitions.ts` turns a definition into labelled sections, so every page reads
  the definition rather than restating it in prose. A definition that gains a
  limitation shows it without anyone editing a page.
- List pages expand with native `details`/`summary` rather than a scripted accordion,
  so expansion works with the keyboard, works before hydration, and ships no client
  JavaScript.
- The config explorer is one statically generated page per definition, with route
  parameters taken from the catalog, so a route cannot exist for something the
  allowlist does not expose. The tree is a view of the catalog, never of a filesystem.
- The boundary test now ignores type-only imports, because TypeScript erases them and
  they cannot pull a filesystem module into the bundle. Treating them as runtime
  imports would force types to be duplicated for no safety gain. With that correction
  only two modules import the harness at runtime.
- The navigation gained a Config explorer entry under Reference, and the navigation
  test was updated to match the section list the console actually has.

## Phase 11 decisions

- The example eval outcomes are computed by the harness's own scorer over example
  judgements, so the page demonstrates the real rules instead of displaying numbers
  somebody typed. One example deliberately shows a full score that still fails.
- Illustrative content is labelled where it is displayed rather than once in a
  footnote, so a screenshot of a page cannot misrepresent it. The runs record carries
  both a notice and a badge.
- Gate outcomes are rendered with the word always present, so passed and unrun are
  never distinguished by colour alone.
- The adoption simulator states what does not change as prominently as what does.
  Only the profile layer varies by stack; roles, procedures and policy are identical,
  and pretending otherwise would have been an easy but dishonest demo.
- The simulator is a client component and declares its view types locally, so it
  never imports a module that reaches the harness.
- The docs page links each topic to its console page and names the authoritative
  repository document, rather than reading Markdown from disk, which would have
  needed filesystem access the console deliberately does not have.
- The navigation test that asserted unbuilt sections exist was replaced once every
  section landed, rather than left to pass vacuously.

## Phase 12 decisions

- The browser suite runs inside `npm run check` rather than beside it, and the
  repository's own declaration now enables the integration-test gate with
  `npm run e2e`. A check the repository does not run is not a check it has.
- If Chromium is missing the suite fails with Playwright's message rather than being
  skipped, which applies the project's own rule that an unavailable check is not a
  passing one to the project itself.
- Which specs run at which width is set in the Playwright config rather than by
  skipping at runtime, so a spec never reports as skipped when it simply does not
  apply to that layout.
- axe is described as finding a real subset of problems. Passing is stated as "no
  automatically detectable violation", never as "accessible".
- Two real defects were fixed rather than accommodated: scrollable regions were made
  keyboard reachable, and the failure badge was made solid because the generator's
  tinted destructive variant fell below the contrast minimum.
- Only Chromium is installed. Firefox and WebKit are named as unverified rather than
  implied to be covered.

## After the twelve phases

Every planned phase is implemented. Two questions left open through the phases are
now settled:

The post-phase adoption layer now also supplies a generic Claude Code starter pack
from `ax init`: `.claude/CLAUDE.md`, settings, project metadata, rules, skills,
role prompts, and a documentation index. It is deliberately a foundation rather
than a copy of a private team workspace. Existing files are preserved individually;
project-specific domain rules, hooks, MCP connections, and tool permissions still
require deliberate configuration.

- **Licensing.** The project is MIT licensed. The grant is scoped in `NOTICE`: it
  covers the work written here and stops short of the preserved learning projects,
  which contain tutorial-derived material the author does not hold rights to.
- **Deployment.** The console is deployed and publicly reachable. The build works
  because the root `prepare` script compiles the harness during install, so the
  platform default of `next build` in `apps/web` finds the workspace package.

What remains is execution: running gates, connecting MCP tools, recording real runs,
and enforcing policy at the point of access. None of it exists, and no part of the
repository claims otherwise. The next piece of work should be a controlled execution
layer, at which point the run schema's refusal of a `recorded` record is removed
deliberately rather than by accident.

## Verification

Run `npm run check`, the CLI, and generated-type drift verification. Legacy
projects are excluded from workspace builds and tests. Later web phases add lint,
unit/UI testing and Playwright at desktop, tablet, 428px and narrower mobile sizes.

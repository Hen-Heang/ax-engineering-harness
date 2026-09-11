# Implementation plan

The user approved the Phase 1 architecture on 2026-09-11. Work proceeds in
bounded phases, inspecting existing code and verifying each change before the next.

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | Repository audit and architecture | Complete |
| 2 | Core package, project schema, validator, context checks, tests | Implemented |
| 3 | Java/Spring profile and resolution | Next |
| 4 | Agents, procedural skills, policies, vendor adapters | Planned |
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

## Phase 3 acceptance criteria

Create a versioned profile schema and explicit Java/Spring definition. Resolve
Maven/Gradle commands without recursive legacy execution or hardcoded AuthHub
assumptions. Reject unknown profiles and ambiguous detection. Test overrides,
missing commands, both wrapper platforms, and contextual architecture assumptions.
Replace Phase 2's syntax-only profile handling with actual resolution and update
the repository's own tooling profile accordingly.

## Verification

Run `npm run check`, the CLI, and generated-type drift verification. Legacy
projects are excluded from workspace builds and tests. Later web phases add lint,
unit/UI testing and Playwright at desktop, tablet, 428px and narrower mobile sizes.

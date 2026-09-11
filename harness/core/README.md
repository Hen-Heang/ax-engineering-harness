# Core boundaries

Implemented:

- `context/resolve.ts` checks local references.
- `profiles/registry.ts` exposes built-in profile definitions by explicit key.
- `profiles/resolve.ts` merges profile defaults into a declaration and revalidates it.
- `buildsystem/detect.ts` detects one build system at a selected root and chooses
  the platform runner form. It reads file names only and executes nothing.
- `permissions/policy.ts` holds the capability vocabulary.
- `permissions/decide.ts` answers what the definitions say about a role. The gate
  runner consults it before running a command, which makes `run_tests` the one
  enforced capability; every other answer is still only a declaration.
- `agents/registry.ts` exposes roles, procedures, and vendor adapters, and refuses
  to load a set of definitions that contradict each other.
- `quality/plan.ts` plans the gate pipeline for a resolved project and keeps
  passed, failed, unavailable, and unrun distinct. It runs no gate.
- `workflow/lifecycle.ts` declares states and permitted transitions, and bounds a
  failure path by the project's declared retry limit. It advances nothing.
- `evals/registry.ts` holds evaluation definitions and scores a supplied judgement.
  It performs no evaluation and stores no results.
- `observability/run.ts` validates run records and refuses one claiming to be a
  real execution, because nothing here can produce one.
- `handoff/check.ts` validates handoff records and checks written handoffs for the
  parts another session needs. It checks structure, never truth.
- `execution/gates.ts` runs the gates a resolved project declares. It is the only
  module that starts a process, runs nothing unless explicitly told to, never invokes
  a shell, and checks the acting role's capability first. A test asserts that
  validation, resolution, context checking and planning cannot reach it.
- `execution/executable.ts` splits a declared command into arguments and resolves the
  executable against PATH, so a command that needs a shell is refused rather than run
  through one.

Planned core responsibilities:

| Area | Responsibility |
| --- | --- |
| tools | MCP adapters, and enforcement for the capabilities they would carry |
| agents | Anything that would actually run a role or an evaluation |

These areas do not depend on Spring, Next.js, Codex, or Claude. Stack assumptions
belong to profile data and vendor instructions to adapters. Empty directories are
intentionally not used as evidence of implemented capabilities.

Core executes a project's declared quality commands, and nothing else. It connects
to no tool, runs no agent, performs no evaluation, and advances no lifecycle state.

# Core boundaries

Implemented:

- `context/resolve.ts` checks local references.
- `profiles/registry.ts` exposes built-in profile definitions by explicit key.
- `profiles/resolve.ts` merges profile defaults into a declaration and revalidates it.
- `buildsystem/detect.ts` detects one build system at a selected root and chooses
  the platform runner form. It reads file names only and executes nothing.
- `permissions/policy.ts` holds the capability vocabulary.
- `permissions/decide.ts` answers what the definitions say about a role. It is not
  an enforcement point and must never be treated as a security boundary.
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

Planned core responsibilities:

| Area | Responsibility |
| --- | --- |
| execution | Running a declared command under tool policy and recording the result |
| tools | MCP adapters and the capability enforcement point |

These areas do not depend on Spring, Next.js, Codex, or Claude. Stack assumptions
belong to profile data and vendor instructions to adapters. Empty directories are
intentionally not used as evidence of implemented capabilities.

Nothing in core executes a project's commands, connects to a tool, runs an agent,
or advances a lifecycle state. Definitions describe intent; a controlled execution
layer does not exist.

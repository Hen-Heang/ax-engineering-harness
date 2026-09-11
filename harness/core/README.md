# Core boundaries

Implemented:

- `context/resolve.ts` checks local references.
- `profiles/registry.ts` exposes built-in profile definitions by explicit key.
- `profiles/resolve.ts` merges profile defaults into a declaration and revalidates it.
- `buildsystem/detect.ts` detects one build system at a selected root and chooses
  the platform runner form. It reads file names only and executes nothing.

Planned core responsibilities:

| Area | Responsibility |
| --- | --- |
| workflow | Lifecycle states, permitted transitions, bounded retries |
| permissions | Capability decisions and concrete approval boundaries |
| quality | Gate plans, results, failure propagation |
| handoff | Goals, decisions, blockers, failed attempts, validation, next steps |
| observability | Evidence-backed run records, tools, files, duration, results |

These areas do not depend on Spring, Next.js, Codex, or Claude. Stack assumptions
belong to profile data and vendor instructions to adapters. Empty directories are
intentionally not used as evidence of implemented capabilities.

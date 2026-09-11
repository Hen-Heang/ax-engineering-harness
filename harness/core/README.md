# Core boundaries

Implemented: `context/resolve.ts` checks local references.

Planned core responsibilities:

| Area | Responsibility |
| --- | --- |
| workflow | Lifecycle states, permitted transitions, bounded retries |
| context | Instruction and context retrieval under tool policy |
| permissions | Capability decisions and concrete approval boundaries |
| quality | Gate plans, results, failure propagation |
| handoff | Goals, decisions, blockers, failed attempts, validation, next steps |
| observability | Evidence-backed run records, tools, files, duration, results |

These areas do not depend on Spring, Next.js, Codex, or Claude. Profile and adapter
implementations are separate. Empty directories are intentionally not used as
evidence of implemented capabilities.

# Workflow and handoff (v1)

Implemented: the lifecycle contract, the permitted transitions, retry bounding, and
the handoff contract with a checker for written handoffs. **Not implemented:
advancing a state.** Nothing moves a task through this lifecycle; asking whether a
transition is allowed is a question about the definition, not about a running task.

## Lifecycle

```text
requirement → load-context → investigate → plan → implement → verify
   → review → evaluate → human-approval → pull-request → handoff → feedback
```

| State | Owned by | On failure |
| --- | --- | --- |
| requirement | a human | — |
| load-context | — | — |
| investigate | Investigator | — |
| plan | Planner | — |
| implement | Backend / Frontend Engineer | — |
| verify | QA Reviewer | → implement |
| review | Integration / Security / Database Reviewer | → implement |
| evaluate | — | — |
| human-approval | a human | → **plan** |
| pull-request | Backend / Frontend Engineer | → implement |
| handoff | — | — |
| feedback | — | terminal |

Forward transitions are deliberately narrow: a stage cannot be skipped, so a task
cannot arrive at review without having been verified.

A failure returns to the state that can actually fix the problem. Note that a
rejected **human approval returns to planning, not to implementation** — if a person
rejects the change, the plan was probably wrong, and re-implementing the same plan
would waste the rejection.

Every role named by a state must be a real registered role, and every transition
target must be a declared state. The lifecycle refuses to load otherwise.

## Bounded retries

A failure path counts as a retry and is bounded by the project's declared
`limits.max_retries`. `checkTransition` combines both rules:

```text
checkTransition('verify', 'implement', retriesUsed, maxRetries)
  → { allowed: true,  retry: true }    while the budget remains
  → { allowed: false, retry: true }    once it is exhausted
```

A project declaring `max_retries: 0` cannot take a failure path at all. Exhausting
the budget is a stop that returns to a human, not a silent loop.

## Handoff

A handoff exists so another session or person can continue without rebuilding the
context. The contract requires `goal`, `status`, `completed`, `changedFiles`,
`decisions`, `blockers`, `failedAttempts`, `nextSteps`, and `validation`.

`blockers` and `failedAttempts` are **required keys**, so omitting them is
impossible: an empty list is an explicit claim that there were none. Failed
attempts are recorded so the next session does not repeat them, which is exactly
the information that tends to get quietly dropped.

`validation` states what was verified **and what was explicitly not verified**.

### Written handoffs

This repository records its own phase handoffs as Markdown rather than JSON.
`checkHandoffDocument` verifies such a document has a `Goal:` statement, a
`Status:` statement, and `## Completed`, `## Decisions`, `## Validation`, and
`## Next steps` sections. A test runs it over every `docs/phase-*-handoff.md` in
this repository, so the project's own practice is held to its own contract.

The checker examines structure only. It cannot tell whether the claims are true.

Contracts: `harness/schemas/workflow.schema.json` and `handoff.schema.json`.
See also [quality gates and evals](quality-and-evals.md).

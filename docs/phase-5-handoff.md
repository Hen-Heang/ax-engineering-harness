# Phase 5 handoff

Goal: model the quality pipeline, lifecycle, evaluations, run records, and handoff
as contracts, with the distinctions that make reporting honest, and without
claiming that anything executes.

Status: complete for Phase 5. Gate execution, MCP connections, real runs, and the
web console remain unimplemented.

## Completed

Added the pipeline, workflow, eval, run, and handoff schemas with generated types.
Added the default quality pipeline, the default lifecycle, the
`cancellation-support` eval, and one example run record. Added `quality/plan.ts`,
`workflow/lifecycle.ts`, `evals/registry.ts`, `observability/run.ts`, and
`handoff/check.ts`. Added `ax quality`, which prints a project's gate plan and
states plainly that nothing ran. No legacy project files changed.

Changed areas: `harness/` (schemas, config, core, cli, quality, workflow, evals,
runs, tests), `README.md`, and `docs/`.

## Decisions

- Readiness and outcome are separate: being ready is not having passed.
- A disabled gate is absent from results rather than counted, and an empty pipeline
  does not pass, so gating nothing cannot report success.
- A rejected human approval returns to planning, not implementation, because a
  rejection usually means the plan was wrong.
- Failure paths are bounded by the declared retry limit; exhausting it stops.
- A missing eval criterion scores zero and is reported, and forbidden behavior is
  disqualifying rather than a deduction.
- `validateRunRecord` rejects `kind: "recorded"`, because nothing here can execute
  a run, so such a record could only be fabricated.
- Unmeasured token and cost fields are omitted, never zeroed.
- The written-handoff checker runs over this repository's own phase handoffs, so
  the project is held to the contract it publishes.

## Validation

On Windows with Node 25.2.1: typecheck passed, 61 tests passed (41 from Phase 4
plus 20 new), the package build passed, and all three CLI commands ran.
`ax quality` reports six applicable gates, all `unrun`, and `Pipeline passed:
false`. `git diff --check` passed and `git diff --name-only` over the four
preserved project trees was empty.

Linux, Node 24, legacy builds, web tooling, and deployment remain untested. No
gate, agent, evaluation, or lifecycle transition has been executed, because no
execution engine exists.

## Corrections and blockers

The generated type for a workflow state's `next` array is a union of fixed-length
tuples, so `includes` inferred a `never` parameter. The array is widened to
`readonly string[]` before searching, with a comment explaining why.

No unresolved test failures or Phase 5 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 6: the Next.js/React profile and full-stack composition. Supply
only commands such a project genuinely has, verify versions at implementation time,
and do not assume Playwright or claim a framework is present merely because a
manifest exists. Full-stack composition must determine affected areas without
inventing parallel agent execution. Continue the remaining phases in
`docs/implementation-plan.md` with scoped commits.

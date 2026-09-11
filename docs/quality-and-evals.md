# Quality gates, evals and runs (v1)

Implemented: the pipeline contract, gate planning from a resolved project, the
outcome model, the eval contract and its scoring, and the run record contract.
**Not implemented: running a gate.** Nothing in this repository executes a
project's commands, so every gate it plans is `unrun`.

```sh
npm run ax -- quality
```

## The outcome model

This is the part worth reading carefully, because it is where honest tooling is
usually lost.

| Outcome | Meaning |
| --- | --- |
| `passed` | The command ran and succeeded. |
| `failed` | The command ran and did not succeed. |
| `unavailable` | No command exists for an applicable gate. Nobody could run it. |
| `unrun` | A command exists, but it was not run. |

`unavailable` and `unrun` are **not** passes. `pipelinePassed` returns true only
when every applicable gate is `passed`, and returns false for an empty pipeline, so
a configuration that gates nothing cannot report success by default.

A gate that the project disabled is **not applicable**: it is absent from the
results entirely rather than counted as a pass.

Readiness is a separate idea from outcome. `ready`, `unavailable`, `manual`, and
`not-applicable` describe whether a gate could be attempted. Being ready is not
having passed.

## The pipeline

| Stage | Kind | Enabled by | Command |
| --- | --- | --- | --- |
| Build | executable | `quality.build` | `commands.build` |
| Lint | executable | `quality.lint` | `commands.lint` |
| Typecheck | executable | `quality.typecheck` | `commands.typecheck` |
| Unit tests | executable | `quality.tests` | `commands.test` |
| Integration tests | executable | `quality.integration_tests` | `commands.integration_test` |
| Security | executable | `quality.security` | `commands.security` |
| Independent review | human | `quality.review` (always on) | — |
| Agent evaluation | eval | `quality.eval` | — |
| Human approval | human | `quality.human_approval` (always on) | — |

Order is cheapest first, so an expensive stage is only reached once the earlier
ones have passed. Review and human approval cannot be disabled by a v1 declaration.

A profile may supply the command for a stage; the project may override it. The plan
records which, so it is always visible whether a command was declared or inherited.

## Evals

An eval assesses **agent behavior**. An application test assesses **software**.

> Did the endpoint return the right status code? — a test.
> Did the agent find the right service, preserve the state rules, add tests, avoid
> unrelated edits, and stay inside its permissions? — an eval.

`cancellation-support` is the worked example: add cancellation to an existing order
service. It declares expected behaviors, forbidden behaviors, required concepts,
quality requirements, and a weighted rubric with a pass threshold.

Two scoring rules matter:

- **A criterion with no judgement scores zero** and is reported as missing. A
  response cannot reach the threshold by leaving criteria out.
- **Forbidden behavior fails the eval outright**, however high the weighted score.
  It is disqualifying, not a deduction.

No scores are stored in this repository, because no evaluation has been run.

## Runs

A run record describes one task execution. Two rules keep it honest:

- **`kind` is required.** `example` is illustrative and was never executed;
  `recorded` requires a real execution. Since nothing here can execute a run,
  `validateRunRecord` rejects `recorded` outright. That check must be removed
  deliberately when an execution engine exists, not before.
- **An unmeasured value is absent, never zero.** Token and cost fields are optional
  and omitted when nothing was measured, so an unmeasured cost is never displayed
  as free. Ask `isMeasured` rather than reading a default.

`example-cancellation` is the one shipped record. It reports integration tests as
`unavailable` rather than passed, because the profile supplies no command for them.
Anywhere it is displayed it must be labelled an example.

Contracts: `harness/schemas/pipeline.schema.json`, `eval.schema.json`,
`run.schema.json`. See also [workflow and handoff](workflow.md).

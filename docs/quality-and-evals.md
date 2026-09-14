# Quality gates, evals and runs (v1)

Implemented: the pipeline contract, gate planning from a resolved project, controlled
local execution of executable gates, the outcome model, the eval contract and its
scoring, and the run record contract. Review, eval, and approval remain manual or
unrun; no agent evaluation is fabricated.

```sh
npm run ax -- quality
npm run ax -- quality --execute
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
| `timed-out` | Execution started but exceeded the configured duration limit. |
| `execution-error` | The process could not be started or managed reliably. |

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

Execution is fail-fast after `failed`, `timed-out`, or `execution-error`. Remaining
executable gates are `unrun`. Manual and unavailable gates make the final result
`INCOMPLETE`, while an executed failure makes it `FAIL`.

Three separate things make a gate `unavailable` rather than failed, because none of
them tells you anything about the code under test:

| Reason | Meaning |
| --- | --- |
| `no-command` | The gate is enabled but neither project nor profile supplies a command. |
| `unsupported-command` | The command needs shell syntax. The runner never switches to a shell. |
| `executable-not-found` | The tool is not installed on this machine. |

Execution is also the one point where a declared capability is enforced rather than
described. The executor takes an explicit actor: a person running the CLI in their
own checkout (`human-cli`), or an agent acting under a role, which must hold
`run_tests`. An unrecognised role is denied rather than defaulted, and a denied run
is `INCOMPLETE` — never a pass.

### Windows batch launchers

`npm`, `gradlew` and `mvnw` are `.cmd` or `.bat` files on Windows, which Node refuses
to start outside a shell (CVE-2024-27980). Those are launched as
`cmd.exe /d /s /c` with an argument vector the runner builds. This is not
`shell: true`: the declared command string is never handed to cmd.exe to re-parse,
the argv is fixed by the parser before this point, and the parser refuses `%` and `^`
as well as every POSIX shell character, so no token means anything to cmd.exe. A
resolved path containing `"`, `%` or `^` is refused outright.

Every execution result carries `launcher`, either `direct` or `cmd.exe`, and it is
persisted in the run record. A run never hides that an interpreter was involved.

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

A run record describes one task execution. Three rules keep it honest:

- **`kind` is required.** `example` is illustrative and cannot carry executor
  provenance. `recorded` requires `source: local-executor`, project identity,
  timestamps, duration, final status, and gate evidence.
- **Local records stay local.** `ax quality --execute` writes JSON under the selected
  project's ignored `.ax/runs/` directory. Existing identifiers are never overwritten,
  and those files are not part of the public web catalog.
- **An unmeasured value is absent, never zero.** Token and cost fields are optional
  and omitted when nothing was measured, so an unmeasured cost is never displayed
  as free. Ask `isMeasured` rather than reading a default.

Persisted command evidence includes the program, arguments, timing, exit status,
timeout state, and truncation state. Stdout and stderr are intentionally omitted to
reduce accidental retention of sensitive output.

`example-cancellation` is the one shipped record. It reports integration tests as
`unavailable` rather than passed, because the profile supplies no command for them.
Anywhere it is displayed it must be labelled an example.

Contracts: `harness/schemas/pipeline.schema.json`, `eval.schema.json`,
`run.schema.json`. See also [workflow and handoff](workflow.md).

# Core boundaries

Implemented:

- `context/resolve.ts` checks local references.
- `profiles/registry.ts` exposes built-in profile definitions by explicit key.
- `profiles/resolve.ts` merges profile defaults into a declaration and revalidates it.
- `buildsystem/detect.ts` detects one build system at a selected root and chooses
  the platform runner form. It reads file names only and executes nothing.
- `doctor/inspect.ts` reports whether a project is ready to use the harness: what is
  declared, what exists on disk, and what could be started if asked. It runs no
  project command — the only filesystem work is the same executable lookup the runner
  does before spawning, so it is safe against a repository nobody has read. It
  returns a report rather than throwing, because a project that is *not* ready is the
  case it exists for. It produces no readiness score: a percentage would put a number
  on a judgement nobody made, and invite the number to be improved rather than the
  project.
- `init/plan.ts` proposes an adoption for a project: it reads manifest *names* at one
  root, recommends a profile, and derives a declaration from what that profile can
  actually supply, so a generated file validates and resolves on the first try. It
  opens no build file and never scans recursively. Where detection is ambiguous — two
  build systems, or two profiles serving one — it refuses and asks, rather than
  picking one.
- `init/apply.ts` writes a plan that was already shown. Every file is opened `wx`, so
  refusing to overwrite is a property of the system call rather than of a check made
  earlier: a file that appears between planning and writing is still safe. An existing
  `AGENTS.md` is left byte-for-byte alone and a template is written beside it, because
  merging repository instructions is a judgement rather than a transformation.
- `permissions/policy.ts` holds the capability vocabulary.
- `permissions/decide.ts` answers what the definitions say about a role, as a plain
  boolean, and builds the capability matrix the console renders.
- `permissions/authorize.ts` is the decision function: given an actor, a capability,
  a project, and an optional approval, it returns `allowed`, `denied`, or
  `requires-approval`. It is pure — no disk, no environment, no ambient state — so a
  decision is reproducible from its inputs alone. Anything unrecognised is denied:
  an unknown role, an unknown capability, and an unknown actor all deny, and no
  branch treats them as permitted. Approval is part of the request rather than
  global state, names the capability it covers, and only ever converts
  `requires-approval` into `allowed` — it can never lift a denial.

  `quality/execute.ts` consults it before running anything, which makes `run_tests`
  the one capability actually enforced today. The decision is taken *inside* the
  executor rather than accepted as an argument, so a caller cannot hand in an
  approval it did not obtain, and there is no arrangement of arguments that reaches
  a process without the answer being consulted. Every other capability is still a
  declaration: no tool layer consults them, so they must not be read as a boundary.
- `agents/registry.ts` exposes roles, procedures, and vendor adapters, and refuses
  to load a set of definitions that contradict each other.
- `quality/plan.ts` plans the gate pipeline for a resolved project and keeps
  passed, failed, unavailable, and unrun distinct. It runs no gate.
- `quality/execute.ts` consumes an existing plan, executes only ready command gates,
  maps detailed command results into gate outcomes, and stops after the first
  executed failure. Manual and unavailable gates remain incomplete.
- `workflow/lifecycle.ts` declares states and permitted transitions, and bounds a
  failure path by the project's declared retry limit. It advances nothing.
- `evals/registry.ts` holds evaluation definitions and scores a supplied judgement.
  It performs no evaluation and stores no results.
- `observability/run.ts` validates examples and recorded runs, requires executor
  provenance for recorded runs, and builds records from quality execution results.
- `observability/storage.ts` persists validated recorded runs under `.ax/runs/`
  without overwriting an existing identifier, and reloads files under a size bound.
- `handoff/check.ts` validates handoff records and checks written handoffs for the
  parts another session needs. It checks structure, never truth.
- `execution/command-parser.ts` accepts only whitespace-separated program and
  argument tokens. Shell operators, redirects, substitutions, quotes, escapes,
  globbing, and control characters are unsupported in v1, as are cmd.exe's `%` and
  `^`, so that no token means anything to a command interpreter on any platform.
- `execution/command-runner.ts` is the vendor-neutral process boundary. It uses
  `spawn` with `shell: false`, captures stdout and stderr separately under one byte
  limit, applies a timeout, and distinguishes command failure from execution failure.

  One exception is deliberate and recorded. `npm`, `gradlew` and `mvnw` are `.cmd`
  or `.bat` files on Windows, and since Node 18.20 `spawn` refuses to start one
  directly (CVE-2024-27980): a batch file can only run under cmd.exe. Those are
  started as `cmd.exe /d /s /c` with an argument vector this module builds, which is
  not `shell: true` — that would hand cmd.exe the declared command *string* to
  re-parse. The argv is already fixed by the parser and contains nothing cmd.exe
  interprets; only the resolved path is quoted, and a path containing `"`, `%` or
  `^` is refused rather than reasoned about. Every result carries `launcher`, which
  is `direct` or `cmd.exe`, and it is persisted in the run record, so a run never
  hides that an interpreter was involved.
- `execution/executable.ts` finds the real file a program name refers to, rather
  than delegating that lookup to a shell. On Windows it follows the PATHEXT rule
  cmd.exe uses, so `npm` resolves to `npm.cmd` and never to the extensionless POSIX
  script beside it, which exists but cannot be started.
- `quality/execute.ts` is the only quality adapter over the generic runner. It is
  also the single point where a declared capability is enforced rather than merely
  described: an agent actor without `run_tests` runs nothing. A test asserts that
  validation, resolution, context checking and planning cannot reach the execution
  modules.

Known limits, which are deliberately not papered over:

- The timeout sends a termination signal to the direct child process. Process-tree
  termination is not guaranteed across platforms, so a grandchild can outlive it.
- The output ceiling is shared across stdout and stderr, so a chatty stream can
  consume the budget the other would have used.
- The byte limit applies to retained output, not to what the child produced.
- A command whose executable is absent is `unavailable`, never `failed`. A missing
  tool says nothing about the code.

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

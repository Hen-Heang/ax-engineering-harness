# AX Engineering Harness

A reusable engineering layer for reliable AI-assisted software development.

Context · Agents · Skills · MCP · Guardrails · Quality Gates · Evals

**Experimental / Learning Project — Phase 8 console navigation and Overview.**

This backend-first project explores how human direction, context, reusable
procedures, controlled tools, verification, and evaluation improve AI-assisted
engineering. It builds on Java, Spring Boot, SQL, and PostgreSQL while learning
and validating agent harnesses, MCP, evaluation, and delivery practices.

## What works today

- Versioned JSON Schemas with generated TypeScript types for projects, profiles,
  agents, skills, policies, adapters, pipelines, workflows, evals, runs and handoffs.
- YAML validation, required gate-command checks, and explicit high-impact denials.
- Context-reference checks including missing files and symlink escape.
- Profile resolution against a built-in registry; unknown profiles fail.
- Composed multi-area profiles, supporting-evidence reporting, and affected-area
  analysis that decides which roles a change involves.
- Maven/Gradle/Node build detection at one explicit root, with Windows and POSIX
  wrapper forms. Ambiguous evidence fails instead of guessing.
- Eight roles, ten procedures, a capability vocabulary, and two vendor adapters,
  with cross-definition checks that keep them coherent.
- Quality pipeline planning that keeps passed, failed, unavailable and unrun
  distinct, a lifecycle with bounded retries, eval scoring, and handoff checking.
- A local read-only CLI, typecheck, automated tests, and package build.
- An `apps/web` console with persistent navigation, a mobile sheet, and an Overview
  page whose status labels come from the definitions rather than a maintained list.
  Tests assert the console can reach no repository file.

**Nothing executes.** Gate execution, MCP connections, live runs, policy
enforcement, and the website are **planned**. Defining a role starts no agent,
planning a pipeline runs no command, and every gate this harness plans is `unrun`.
No production maturity or live metrics are claimed.

## Architecture

```text
Human → AX Harness Core → Agent roles → Controlled tools → Software
                  ↑                                  ↓
                  └──── Feedback ← Verification ─────┘

AX Harness Core → Codex adapter → AGENTS.md
                → Claude adapter → CLAUDE.md
```

Core contracts are vendor-neutral. Profiles describe stack conventions; agents
are roles; skills are procedures; tools provide capabilities; policies bound
access. Tests evaluate software; evals evaluate agent behavior.

## Quick start

Use Node.js 24 LTS and npm. Existing Java projects retain their own toolchains.

```sh
npm ci
npm run ax -- validate      # resolve and check a project declaration
npm run ax -- quality       # plan the quality pipeline for a project
npm run ax -- policy        # print the capability matrix
npm run check               # build, typecheck, lint, tests, console build
npm run dev --workspace @ax-harness/web   # run the console locally
```

`check` runs the new Harness typecheck, tests, and build, not legacy Java builds.

## Applying to another project

Create `.ax/project.yaml` using the [current declaration](.ax/project.yaml) as a
structural example, replacing commands and context references with your own.
Validate it from this checkout:

```sh
npm run ax -- validate /path/to/your-project/.ax/project.yaml
```

`project.profile` must name a built-in profile. A profile may fill in commands the
declaration omits; commands you declare always win. Set `project.build_system`
when several build manifests sit in one root. See the
[configuration documentation](docs/project-configuration.md) for fields and limits,
and [profiles](docs/profiles.md) for the profile contract.

## Target profiles

| Profile | Status |
| --- | --- |
| `harness-tooling` — this repository's Node workspace | Implemented |
| `java-spring` — Java / Spring, Maven or Gradle | Experimental |
| `nextjs-react` — Next.js App Router on Node | Experimental |
| `fullstack` — composed backend and frontend areas | Experimental |
| Multi-repository execution | Planned; rejected by current schema |

Profiles supply only commands a project reliably has. `java-spring` supplies build
and test; Java has no single standard lint, typecheck, security, or integration-test
command. `nextjs-react` supplies only build and security, because a Next.js linter
is optional, no typecheck or test script is scaffolded, and Playwright is never
assumed. `fullstack` supplies nothing at all: it resolves a backend and a frontend
area with their own profiles and runners, and the project declares commands that
cover both. Neither has been validated against the legacy projects preserved here.

## Roles, procedures and permissions

Eight roles (Investigator, Planner, Backend Engineer, Frontend Engineer, Database
Reviewer, Security Reviewer, QA Reviewer, Integration Reviewer) follow ten
procedures (investigate, plan-feature, implement-feature, debug, backend-review,
frontend-review, sql-review, security-review, test, handoff).

Two of the eight roles may change a file. None may write a database, push to the
default branch, force push, deploy to production, or read a secret. Opening a pull
request requires human approval. Run `npm run ax -- policy` to print the matrix
from the definitions themselves.

See [agents and skills](docs/agents-and-skills.md), [policies](docs/policies.md),
and [adapters](docs/adapters.md).

## Quality, workflow and evaluation

Gate outcomes keep **passed, failed, unavailable and unrun distinct**; a gate
nobody could run and a gate nobody did run have not passed, and a pipeline that
gates nothing does not report success. The lifecycle permits only declared
transitions, and a failure path is bounded by the project's declared retry limit.
Evals assess agent behavior rather than software: a missing criterion scores zero,
and forbidden behavior is disqualifying rather than a deduction. Run records must
declare whether they are an example or a real execution, and an unmeasured value is
absent rather than zero.

See [quality gates and evals](docs/quality-and-evals.md) and
[workflow and handoff](docs/workflow.md).

## Repository structure

```text
.ax/                  Repository configuration declaration
harness/              Schemas, validation, resolution, registries, CLI, tests
harness/profiles/     Built-in profile definitions
harness/agents/       Role definitions
harness/skills/       Procedure definitions
harness/policies/     Capability vocabulary
harness/adapters/     Vendor entrypoint definitions
harness/quality/      Quality pipeline definition
harness/workflow/     Lifecycle definition
harness/evals/        Evaluation definitions
harness/runs/         Example run records, never real executions
apps/web/             AX Engineering Console, rendering the allowlisted catalog
docs/                 Architecture, audit, configuration, building blocks, plan
AGENTS.md             Shared instructions and preservation boundaries
CLAUDE.md             Claude Code adapter surface
HISTORY.md            Original dev-lab README
AuthHub/              Preserved independent Gradle projects
heang-api-center/     Preserved Maven project
heang-dev-lab/        Preserved Maven project
spring-boot-lab/      Preserved labs, including divergent AuthHub
```

Integrations and additional core capabilities arrive in their implementation
phases. All existing project trees remain in place.

## Safety philosophy

Least privilege, explicit tools, isolated work, quality gates, and human approval.
V1 declarations forbid main/force pushes, production deployment, DB writes, and
secrets access, and the capability vocabulary denies the same five to every role.
Profiles may only contribute commands; they cannot relax a permission or mark an
unsupplied gate as satisfied. None of this sandboxes an external agent:
enforcement requires the future controlled execution/tool layer. Never put
credentials in configuration. The future public catalog must only include
explicitly allowlisted safe files.

## Web showcase and roadmap

The **AX Engineering Console** in `apps/web` renders an explicit allowlisted
catalog built from the real definitions, so the site cannot drift from the harness.
It reads no repository file, runs no command, and records no execution, and tests
enforce that. Navigation, architecture and workflow diagrams, the configuration
explorer, and the adoption simulator arrive in later phases; demo runs and evals
stay labelled as examples. See [the console](docs/web-console.md).

The [implementation plan](docs/implementation-plan.md) tracks twelve phases.
Next: the architecture and workflow visualizations, then the building-block pages
and the configuration explorer.

See [architecture](docs/architecture.md), [audit](docs/repository-audit.md), and
[history](HISTORY.md). This is an evolving learning project, not an expertise or
production-adoption claim. Licensing for distribution remains to be decided.

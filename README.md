# AX Engineering Harness

A reusable engineering layer for reliable AI-assisted software development.

Context · Agents · Skills · MCP · Guardrails · Quality Gates · Evals

**Experimental / Learning Project — Phase 2 configuration foundation.**

This backend-first project explores how human direction, context, reusable
procedures, controlled tools, verification, and evaluation improve AI-assisted
engineering. It builds on Java, Spring Boot, SQL, and PostgreSQL while learning
and validating agent harnesses, MCP, evaluation, and delivery practices.

## What works today

- Versioned project JSON Schema and generated TypeScript types.
- YAML validation, required gate-command checks, and explicit high-impact denials.
- Context-reference checks including missing files and symlink escape.
- A local read-only CLI, typecheck, automated tests, and package build.

Profile resolution, policy enforcement, agents, MCP connections, quality execution,
evals, live runs, and the website are **planned**. No production maturity or live
metrics are claimed. Validation does not execute commands or authorize tools.

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
access. Tests evaluate software; agent evals will assess engineering behavior.
Adapters are planned translations of shared instructions.

## Quick start

Use Node.js 24 LTS and npm. Existing Java projects retain their own toolchains.

```sh
npm ci
npm run ax -- validate
npm run check
```

`check` runs the new Harness typecheck, tests, and build, not legacy Java builds.

## Applying to another project

Create `.ax/project.yaml` using the [current declaration](.ax/project.yaml) as a
structural example, replacing commands and context references with your own.
Validate it from this checkout:

```sh
npm run ax -- validate /path/to/your-project/.ax/project.yaml
```

Profile identifiers are currently syntax-checked only. See
[configuration documentation](docs/project-configuration.md) for fields and limits.

## Target profiles

| Profile | Status |
| --- | --- |
| Java / Spring, Maven / Gradle | Planned — next phase |
| Next.js / React | Planned |
| Full-stack composition | Planned |
| Multi-repository execution | Planned; rejected by current schema |

## Repository structure

```text
.ax/                  Repository configuration declaration
harness/              Schema, validator, CLI, context checks, tests
docs/                 Architecture, audit, configuration, implementation plan
AGENTS.md             Instructions and preservation boundaries
HISTORY.md            Original dev-lab README
AuthHub/              Preserved independent Gradle projects
heang-api-center/     Preserved Maven project
heang-dev-lab/        Preserved Maven project
spring-boot-lab/      Preserved labs, including divergent AuthHub
```

`apps/web`, profiles, integrations, and additional core capabilities arrive in
their implementation phases. All existing project trees remain in place.

## Safety philosophy

Least privilege, explicit tools, isolated work, quality gates, and human approval.
V1 declarations forbid main/force pushes, production deployment, DB writes, and
secrets access. They do not sandbox external agents: enforcement requires the
future controlled execution/tool layer. Never put credentials in configuration.
The future public catalog must only include explicitly allowlisted safe files.

## Web showcase and roadmap

The planned **AX Engineering Console** in this repository's `apps/web` will offer
architecture/workflow diagrams, Config Explorer, building-block documentation,
permission matrices, and an adoption simulator. Demo runs/evals will be labeled.

The [implementation plan](docs/implementation-plan.md) tracks twelve phases.
Next: Java/Spring profiles, roles, skills, policies, quality/evaluation foundations,
then the Next.js console and responsive verification.

See [architecture](docs/architecture.md), [audit](docs/repository-audit.md), and
[history](HISTORY.md). This is an evolving learning project, not an expertise or
production-adoption claim. Licensing for distribution remains to be decided.

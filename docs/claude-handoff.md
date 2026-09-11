# Codex → Claude Code handoff

Prepared 2026-09-11 at the user's request because their Codex token allowance was
nearly exhausted. This is a durable engineering handoff and consolidated brief,
not a verbatim chat export. Read the referenced repository files for exact code.

## Resume here

User's latest development authorization: proceed with Phase 3, Java/Spring profile
architecture and resolution. Codex inspected the current foundation and official
Maven/Gradle documentation, but the user interrupted to transfer context BEFORE
any Phase 3 edits. No Phase 3 implementation exists. No background command from
that inspection remains known to be running.

1. Read AGENTS.md, this file, docs/implementation-plan.md, and docs/phase-2-handoff.md.
2. Check git status and inspect the schema, validator, loader, CLI, and tests.
3. Implement Phase 3 in a bounded change, verify, document, and commit logically.
4. Continue phase by phase toward the larger brief below. Do not collapse all
   remaining phases into one massive change or ask again to redo completed work.

## Repository and state

- Existing repository: https://github.com/Hen-Heang/ax-engineering-harness
- Local checkout: C:\Practice\API\ax-engineering-harness
- Shell: PowerShell; timezone Asia/Seoul.
- Branch: ax-harness/phase-2-foundation
- Latest implementation commit: 7ab0e2f — feat(harness): add phase 2 configuration foundation
- Previous baseline: 541112b
- Nothing was pushed. No PR or deployment was created.
- Working tree was clean before adding this handoff and root CLAUDE.md.
- These two transfer files are intentionally left uncommitted for the next session.
- Node installed: 25.2.1; recommended project runtime: Node 24 LTS (.nvmrc).
- npm dependencies installed; package-lock.json committed. Java 21 installed.

## Non-negotiable user requirements

- Use THIS repository. Never create another GitHub repository.
- Preserve AuthHub/, heang-api-center/, heang-dev-lab/, and spring-boot-lab/.
- Do not move them into examples/, delete, merge, or refactor them without a
  separate explicit approval. Nested spring-boot-lab/AuthHub contains different
  work from root AuthHub and must remain intact.
- Inspect before each major phase. Preserve working behavior and unrelated changes.
- Keep commits scoped. No main push, force push, production deployment, database
  writes, destructive operations, secrets exposure, or external messages implied.
- Vendor-neutral AX Harness Core owns the reusable concepts. Codex and Claude
  files are adapters, not competing architectures.
- Never fabricate production claims, metrics, runs, test results, costs, or evals.
- Distinguish Implemented, Experimental, Planned. Mark static examples as Demo/Example.
- Do not silently ignore failed checks or suppress failures to make CI green.
- The public website must never expose arbitrary repository files or credentials.

## Purpose and personal positioning

AX Engineering Harness: a reusable engineering layer for reliable AI-assisted
software development. It is a real reusable developer tool, a learning project,
and a portfolio-quality technical showcase.

Owner is backend-first: Java, Spring Boot, SQL, PostgreSQL, backend architecture,
AI-assisted software development. Growing areas: AX engineering, agent harnesses,
MCP, evaluation, DevOps, system architecture. Use learning, experimenting,
exploring, implementing, validating, evolving. Do not portray experimental areas
as established expertise.

Product message: reliable AI-assisted engineering involves human direction +
context + agents + skills + tools + permissions + verification + evaluation;
it is more than asking an LLM to generate code.

## Audit already completed

See docs/repository-audit.md and HISTORY.md. Baseline contained 1,257 tracked files,
54 Maven manifests, and three Gradle build roots. Existing projects are independent:

- AuthHub: Java 17, Spring Boot 3.5.15; common-api, security-api, todoapi.
- AuthHub/legacy/spring-jwt-auth: separate archived Gradle project.
- heang-api-center: Maven, Java 17, Spring Boot 4.0.3, WebFlux/API practice.
- heang-dev-lab: Maven, Java 21, Spring Boot 4.0.3, MyBatis 4.0.1; documentation
  has older versions, so inspect actual manifests.
- spring-boot-lab: many examples/aggregators, Java 11/17, Spring Boot 2.x/3.x,
  including the divergent AuthHub copy.

Legacy configurations contain credential-related settings and some tests require
databases. Do not recursively run all projects or publish their configuration.
Some paths contain spaces and #. No root license was found; distribution licensing
remains undecided. The audit did not establish that legacy builds pass.

## Implemented in Phase 2

- Isolated npm workspace containing only harness/.
- Strict project JSON Schema v1 with generated TypeScript types.
- YAML loader with 64 KiB limit; rejects duplicate keys, aliases, unknown tags,
  multiple documents, invalid UTF-8, malformed structure, unknown fields.
- Required-command checks for enabled quality gates.
- Configuration denies main/force pushes, deployment, DB writes, secrets access.
- Context-reference validation: relative Markdown paths, existence, regular files,
  symlink containment within project root. Checks metadata, not contents.
- Read-only CLI: npm run ax -- validate [path/to/.ax/project.yaml].
- Tests, build, typecheck, generated-type drift test.
- Root README now accurately describes AX Harness; HISTORY.md preserves old README.
- Root AGENTS.md and architecture/configuration/audit/plan documentation.

Relevant files:

- harness/schemas/project.schema.json — authoritative contract
- harness/config/project.generated.ts — generated; do not edit manually
- harness/config/validate.ts — schema and semantic validation
- harness/config/load.ts — parser and bounded file loader
- harness/core/context/resolve.ts — context checks
- harness/cli/index.ts — current CLI
- harness/index.ts — public package exports
- harness/tests/ — 13 existing tests
- .ax/project.yaml — own declaration; profile harness-tooling is currently unresolved

Verification at commit 7ab0e2f: 13 tests passed, typecheck passed, package build
passed, CLI passed, compiled package import passed, git diff --check passed.
Install audit reported zero vulnerabilities. Tested on Windows/Node 25.2.1 only.
Legacy builds, browser tests, Linux, Node 24, and deployment were not verified.

Important implementation boundary: profile IDs are currently ONLY syntax-checked.
No profile definitions, profile resolution, policy evaluator, agent runner, MCP
connection, quality execution, eval runner, or web app exists yet.

Generated types must be .ts sources so the build emits declarations for consumers.
A declaration-only source originally failed to provide this packaging guarantee;
that was fixed. Node's test runner + tsx is used rather than Vitest for this small
library; choose appropriate web tests later.

## Phase 3: next concrete work

Acceptance criteria already agreed:

- Add a versioned profile schema and Java/Spring profile definition.
- Add real profile lookup/resolution; unknown profiles fail.
- Supply a real harness-tooling profile for this repository's own declaration.
- Detect Maven versus Gradle at the selected project/build root. Ambiguity must
  fail or require explicit project selection; never arbitrarily choose one.
- Handle Maven wrappers and Gradle Groovy/Kotlin layouts, Windows versus POSIX
  command forms, explicit command overrides, missing wrappers/commands.
- Profile defaults must not overwrite project choices, weaken permission policy,
  or mark unavailable quality gates as passed.
- Keep stack-specific filenames, defaults, and assumptions in profile data.
- No running wrappers, parsing build scripts by executing them, recursive scans
  of legacy projects, or changes to legacy manifests.
- Test resolution, ambiguity, invalid profiles, overrides, missing commands,
  both platform command forms, and preservation of architecture assumptions.
- Update README, CLI wording, own configuration, generated types, and docs to
  match actual behavior. Keep limitations explicit.

Design questions identified but NOT implemented or finalized:

- Phase 2 validates required commands before any profile exists. Phase 3 needs
  separate declaration validation and post-resolution command validation, so a
  profile can supply defaults without weakening the existing final checks.
- An optional generic build-system selector could resolve ambiguous manifests.
- Profile source could be YAML with an explicit built-in registry and build-time
  asset copying. Do not invent dynamic filesystem paths from untrusted profile IDs.
- Manifest detection is evidence of build system, not proof that Spring Boot is
  installed or that JDK/plugin versions, tasks, wrappers, or tests will work.
- Inspect integration-test configuration before assigning Maven verify or a
  Gradle integrationTest task; do not claim arbitrary projects define these.

Official references inspected:

- https://docs.gradle.org/current/userguide/gradle_wrapper.html
- https://maven.apache.org/tools/wrapper/
- https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html

## Target structure (incremental, not all present)

```text
AGENTS.md, README.md, HISTORY.md, .ax/project.yaml
harness/
  core/{workflow,context,permissions,quality,handoff,observability}/
  profiles/{java-spring,nextjs-react,fullstack}/
  agents/
  skills/
  policies/
  evals/
  schemas/
  adapters/{codex,claude}/
integrations/{github,postgres,codebase,docs}/
apps/web/
examples/
docs/
AuthHub/                preserved
heang-api-center/      preserved
heang-dev-lab/         preserved
spring-boot-lab/       preserved
```

## Remaining functional brief

### Core and configuration

Generic lifecycle: Requirement → Load instructions → Retrieve context → Investigate
→ Plan → Implement → Verify → Review → Evaluate → Human approval → PR/CI → Handoff
→ Feedback/improvement. Core owns context loading, planning, permissions, tool
policy, gates, evaluation, observability, handoff, retries, and approval boundaries.
It must not depend on Spring or Next.js. Commands belong in project/profile data.

Portable .ax/project.yaml describes project, profile, context, commands, tools,
permissions, quality. Keep schema validation and invalid-config tests. Current
schema additionally requires explicit limits and keeps multi-repo unsupported.
Future multi-repo support must not be claimed before implemented.

### Profiles

Java/Spring: Java, Spring Boot, Maven/Gradle, controller/service/repository/mapper,
REST, Spring Security, transactions, SQL/PostgreSQL, unit/integration tests.
Next.js/React: App Router, TypeScript, server/client components, routes/components,
API integration, lint/typecheck, unit tests, Playwright, accessibility/responsiveness.
Full-stack: determine affected areas, coordinate backend/frontend work, integration
review, shared quality gates. Do not create unnecessary multi-agent complexity.

### Roles and procedures

Eight agents: Investigator, Planner, Backend Engineer, Frontend Engineer, Database
Reviewer, Security Reviewer, QA Reviewer, Integration Reviewer. Each defines
purpose, responsibilities, required context, allowed tools, forbidden actions,
inputs/outputs, relevant skills, escalation. Avoid overlapping ownership.

Ten skills: investigate, plan-feature, implement-feature, debug, backend-review,
frontend-review, sql-review, security-review, test, handoff. Each defines purpose,
prerequisites, steps, tools, output, verification, failure/escalation behavior.
Agent = role; skill = procedure. Definitions do not mean agents are running.

### Tools/MCP and permissions

Agent → Tool policy → MCP/tool adapter → External capability. MCP is the interface,
not business logic. Initial targets: GitHub, DB metadata, codebase, documentation.
GitHub reads: repo/files/commits/issues/PRs/CI/workflow results. Controlled writes:
branch work, issue comments, PR creation/comments. High-impact actions require
human approval; force push, main push, production deploy, secrets, destructive DB
operations are denied by default. Metadata-only DB access initially.

### Quality, evals, observability, handoff

Pipeline: Build → Lint/typecheck → Unit tests → Integration tests → Security →
Independent review → Eval → Human. Profiles map gates to actual commands.
Unavailable/failed/unrun checks are distinct from pass; no silent skipping.

Eval schema: task, expected/forbidden behaviors, required files/concepts, quality
requirements, scoring, final outcome. Example task: cancellation support that
identifies the service, preserves state rules, tests, avoids unrelated edits,
and respects permissions. Evals assess behavior; application tests assess software.
Build a modest foundation, not a fake sophisticated benchmark.

Run model: ID, task, agent, profile, tools, files read/changed, duration, retries,
gate results, eval result, final status. Cost/tokens can remain optional/unmeasured.
Handoff: goal, completed work, status, changed files, decisions, blockers, failed
attempts, next steps, validation. Allow resumption without rebuilding context.

## Website brief (Phases 7–12)

Build apps/web in THIS repository with current compatible stable Next.js App Router,
TypeScript, Tailwind, shadcn/ui primitives, Lucide, @xyflow/react. Verify versions
at implementation time. Name: AX Engineering Console.

Developer console + docs + configuration explorer + architecture visualization.
Not a generic SaaS dashboard, chatbot, marketing landing page, or copy of another
product. Technical, minimal, professional, calm, strong typography, subtle borders,
restrained accent, dark mode, dense but uncluttered. Avoid glowing cards, excessive
gradients/animation, AI-purple styling, glassmorphism, and fake metrics.

Persistent navigation:

- Overview, Architecture, Workflow
- Building blocks: Profiles, Agents, Skills
- Integrations: MCP & Tools, Policies
- Quality: Quality Gates, Evals, Runs
- Adoption: Projects
- Reference: Docs

Page requirements:

- Overview: purpose/how/why/compatible projects; hero "A reusable engineering layer
  for reliable AI-assisted software development"; Experimental/Learning status;
  Human → Harness → Agent → Tools → Software → Verification → Feedback mental model;
  target profiles and honest implementation status.
- Architecture: strong React Flow custom-node visualization: Human/request/core;
  context/workflow/policy; planner; backend/frontend/specialists; MCP/tools; project;
  quality; evals; human review; PR. Non-editable. Click nodes for what/why,
  responsibilities, inputs/outputs, related roles/skills/tools, config examples.
- Workflow: clickable lifecycle stages with input/action/agent/tools/output/failure
  path. Show bounded retry/failure flow clearly without diagram clutter.
- Config Explorer: desktop file/section tree + inspector + real YAML/JSON/Markdown
  source. Profiles show capabilities/commands/agents/skills/tools/gates. Responsive.
- Profiles: cards and detail pages with intended type, detection, architecture
  assumptions, default roles/skills, gates, commands, limitations, status badges.
- Agents: role cards/detail views with tools, procedures, permissions and boundaries.
- Skills: procedure details and steps, explicitly distinguish Agent ≠ Skill.
- MCP/tools: interface versus capability, policy flow, integration statuses.
- Policies: clear role/capability matrix showing reads, edits, tests, metadata,
  controlled PRs, denied DB writes/main pushes/production deployments.
- Quality: pipeline and applicability by profile, never fabricated results.
- Evals: tests versus behavior evals, cancellation example, labeled example scores.
- Runs: execution-history UI foundation; run/task/agent/profile/duration/quality/
  eval/status. Static records must say Demo run or Example.
- Projects: adoption via project + .ax/project.yaml + AGENTS.md + profile/tools/
  gates; interactive Spring/Next.js/full-stack simulator showing active building
  blocks/policies. May run purely from static validated configuration.
- Docs: introduction, architecture, quick start, config, profiles, agents, skills,
  MCP, permissions, quality, evals, handoff, adoption into existing projects.

Source of truth: actual safe profile/role/skill/config definitions → typed loader
→ UI and Config Explorer. Avoid disconnected hardcoded documentation. Use an
explicit public allowlist and never give browser arbitrary server capabilities.

Responsive/accessibility: test desktop, tablet, mobile including 428px (iPhone 12
Pro Max approximate width) and a narrower viewport. Sidebar becomes shadcn Sheet;
no accidental horizontal overflow; diagrams fitView and accessible detail/text
alternatives; source blocks intentionally scroll; visible focus, keyboard access,
contrast, accessible tap targets. React Flow only for useful node relationships.

Web verification: typecheck, lint, unit tests, build, important UI tests, Playwright
navigation/responsive flows. Harness: schema/invalid config/profile/policy tests.
Use shadcn primitives such as Button/Card/Badge/Tabs/Sheet/Dialog/Tooltip/Select/
Accordion/ScrollArea/Table where appropriate rather than rebuilding primitives.

## Phase order

1. Audit/architecture — complete.
2. Schema/core foundation — complete (7ab0e2f).
3. Java/Spring profile — authorized, not started beyond inspection.
4. Agents + skills + policies.
5. Quality + eval foundations.
6. Next.js profile (and full-stack composition).
7. apps/web foundation.
8. Overview/navigation.
9. Architecture/workflow visualizations.
10. Profiles/agents/skills/tools/Config Explorer.
11. Quality/evals/projects/docs/run foundation.
12. Tests/accessibility/responsive QA/documentation.

README must remain accurate through each phase: purpose/status/architecture/core
concepts/profiles/roadmap/structure/quickstart/adoption/safety/showcase/learning
disclaimer. Historical dev-lab information stays in HISTORY.md.

## User-provided inspiration/context links

These were unavailable through Codex browsing; do not pretend to have read them.
They are references, not permission to copy their design or publish private content.

- https://we-adp-developer-vch.vercel.app/#overview
- https://henheang.site/lab/ax-engineering
- https://app.notion.com/p/AX-Software-Engineer-Backend-AI-Systems-c2d37144a4b44c738c42f677bf148dc1?source=copy_link
- https://app.notion.com/p/Claude-X-SaaS-OLV-Project-672acd8b7450838d8e9d0131800ae6db?source=copy_link

## Useful commands

```sh
git status --short
npm run check
npm run ax -- validate
npm run generate:types --workspace @ax-harness/core
git diff --check
git diff --name-only -- AuthHub heang-api-center heang-dev-lab spring-boot-lab
```

No new dependencies or phase changes were installed during the interrupted Phase 3
inspection. Do not rerun the full historical audit; inspect what is relevant to the
next phase and preserve the existing foundation.

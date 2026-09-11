# Phase 4 handoff

Goal: define the engineering roles, the procedures they follow, the capabilities
they may use, and the vendor entrypoints that reach them — as versioned data with
the same rigour profiles received, and without implying that anything runs.

Status: complete for Phase 4. Quality execution, evals, run records, MCP
connections, and the web console remain unimplemented.

## Completed

Added the agent, skill, policy, and adapter schemas with generated types; eight
role definitions, ten procedure definitions, a fourteen-capability vocabulary, and
the Codex and Claude adapter definitions. Added a registry that validates every
built-in definition and refuses to load a set that contradicts itself, plus
`permissions/policy.ts` and `permissions/decide.ts` for the vocabulary and the
matrix derived from it. Added `ax policy`, which prints the matrix. Type
generation now loops over the schema directory. No legacy project files changed.

Changed areas: `harness/` (schemas, config, core, cli, agents, skills, policies,
adapters, scripts, tests), `README.md`, and `docs/`.

## Decisions

- One capability vocabulary serves both agents and skills, so the matrix is
  derived rather than maintained by hand.
- The five denied capabilities reuse the project schema's permission identifiers,
  and a test asserts the sets are identical, so the two contracts cannot drift.
- Capabilities name the project tool they depend on, so a role's required tools
  follow from its capabilities.
- The consistency guard is a pure exported function, so the guard is itself tested
  with deliberately broken definitions rather than assumed to work.
- Roles are labelled experimental: the definitions are real and reviewed, but no
  execution engine exists and none is implied by defining eight roles.

## Validation

On Windows with Node 25.2.1: typecheck passed, 41 tests passed (29 from Phase 3
plus 12 new), the package build passed, and both CLI commands ran. `ax policy`
prints a matrix in which two of eight roles may edit a file and none may write a
database, push to the default branch, force push, deploy, or read a secret.
`git diff --check` passed and `git diff --name-only` over the four preserved
project trees was empty.

Linux, Node 24, legacy builds, web tooling, and deployment remain untested. No
agent has been executed, because no runner exists.

## Corrections and blockers

The first version of the guard test used a stub vocabulary that omitted
`github_read` and the `handoff` skill, so the baseline case reported errors. The
fixture was wrong, not the guard; the fixture was corrected.

`AGENTS.md` serves as both the vendor-neutral instruction document and the Codex
entrypoint. Rather than invent a separate shared file, the Codex adapter records
that its entrypoint and shared document coincide.

No unresolved test failures or Phase 4 blockers. Distribution licensing remains
undecided and does not block local development.

## Next steps

Implement Phase 5: quality gate, eval, run record, and handoff contracts. Gate
results must keep passed, failed, unavailable, and unrun distinct; evals must
assess agent behavior rather than software; run records must not invent values.
Continue the remaining phases in `docs/implementation-plan.md` with scoped commits.

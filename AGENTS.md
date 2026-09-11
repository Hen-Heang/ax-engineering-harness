# AX Engineering Harness — repository instructions

Read `docs/implementation-plan.md` and the current package instructions before changes.

## Scope and preservation

- Evolve this repository; never create a replacement repository.
- Preserve `AuthHub/`, `heang-api-center/`, `heang-dev-lab/`, and all of
  `spring-boot-lab/`, including its divergent AuthHub copy. Do not move, merge,
  delete, or refactor these projects as part of Harness implementation.
- Project-local instructions apply when working inside those projects.
- Keep changes and commits scoped to the current implementation phase.
- Do not recursively run legacy applications, tests, database setup, or migrations.

## Architecture

- Generic contracts belong to `harness/core` and `harness/schemas`.
- Stack assumptions belong to profiles; vendor instructions belong to adapters.
- Agent means role; skill means procedure. Do not introduce automatic parallel
  agent execution merely because multiple roles are defined.
- JSON Schema is authoritative for configuration. Regenerate types after edits.
- Keep the public website dependent on explicitly allowlisted safe definitions.
  Never publish arbitrary repository files or local run artifacts.

## Verification and permissions

- Run `npm run check` for Harness changes. Report failed or unrun checks honestly.
- Configuration validation does not authorize command execution or tool access.
- Never push directly to main, force push, deploy production, expose credentials,
  or write to a database as an implied step of Harness development.
- Use accurate Implemented, Experimental, and Planned labels. Never invent runs,
  evaluations, metrics, costs, or production adoption claims.
- Describe the project as backend-first learning, experimentation, and validation.

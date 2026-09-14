# Agents and skills (v1)

Implemented: the agent and skill schemas, the built-in registry, and the
cross-definition checks that keep roles and procedures coherent. Planned:
anything that runs them.

**Nothing here executes.** These are definitions a human or an agent reads and
follows. Defining eight roles does not start eight agents, does not imply parallel
execution, and grants no access. The harness has no runner.

## Agent is not skill

| | Agent | Skill |
| --- | --- | --- |
| Is a | role | procedure |
| Answers | who owns this | how it is done |
| Holds | capabilities and responsibilities | ordered steps and verification |
| Reused by | nothing; a role is a role | many roles |

A role lists the procedures it follows. A procedure lists the capabilities it
needs. The registry rejects a role that lists a procedure whose capabilities it
does not hold, so a role can never be defined as able to follow a procedure it
could not actually carry out.

## Roles

| Agent | Owns | Can edit | Notable denial |
| --- | --- | --- | --- |
| Investigator | Accuracy of findings about existing behavior | No | Must not plan or fix |
| Planner | Scope, sequencing, approval points | No | Must not expand scope |
| Backend Engineer | Backend implementation and its tests | Yes | No database writes |
| Frontend Engineer | Frontend implementation and its tests | Yes | No backend contract changes |
| Database Reviewer | Schema, indexing, migration safety | No | Metadata only, never row data |
| Security Reviewer | The security verdict | No | Never echoes a secret value |
| QA Reviewer | Reported gate results and their evidence | No | Never edits to make a gate pass |
| Integration Reviewer | Agreement between layers | No | Does not re-review layer internals |

Ownership is deliberately non-overlapping: the Investigator does not plan, the
Planner does not implement, the engineers do not sign off on their own work, and
the Integration Reviewer does not repeat what the layer reviewers already own. A
test asserts that no two roles share the same capabilities and procedures.

## Procedures

`investigate` · `plan-feature` · `implement-feature` · `debug` · `backend-review`
· `frontend-review` · `sql-review` · `security-review` · `test` · `handoff`

Each states purpose, prerequisites, ordered steps, required capabilities, outputs,
verification, and escalation. Two of them carry the rules this project cares most
about:

- `test` keeps **passed, failed, unavailable, and unrun** distinct. A gate with no
  command is unavailable, never passed, and no substitute command may be invented.
- `handoff` requires failed attempts to be recorded, not quietly dropped, so the
  next session does not repeat them.

## Definitions

Roles live in `harness/agents/<id>/agent.json` and procedures in
`harness/skills/<id>/skill.json`. Contracts are
`harness/schemas/agent.schema.json` and `harness/schemas/skill.schema.json`.

Every role and procedure is marked **experimental**: the definitions are real and
reviewed data, but no agent runtime exists to carry them out. Local quality command
execution does not pretend to be an agent. See
[policies](policies.md) for what each role is permitted to do, and
[adapters](adapters.md) for how vendor tools reach these instructions.

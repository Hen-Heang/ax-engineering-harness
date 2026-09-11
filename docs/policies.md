# Policies and capabilities (v1)

Implemented: the capability vocabulary, the role-to-capability matrix, and the
checks that keep it consistent with the project schema. **Not implemented: any
enforcement.**

This distinction matters more than anything else on this page. Asking whether a
role may do something tells you what the definitions say. It does not open a
connection, grant access, or constrain a tool. A future tool layer must enforce
policy at the point of access; until then these declarations describe intent, and
must never be mistaken for a security boundary.

## The point

AX engineering is about **controlled capability, not maximum autonomy**. Reads are
broad, writes are narrow and reviewed, and the five highest-impact capabilities are
available to nobody.

Print the live matrix from the definitions:

```sh
npm run ax -- policy
```

## Capabilities

| Capability | Tool | Risk | Who holds it |
| --- | --- | --- | --- |
| `read_code` | codebase | low | every role |
| `read_docs` | docs | low | every role |
| `github_read` | github | low | every role |
| `database_metadata` | database | medium | Investigator, Backend Engineer, Database Reviewer |
| `run_tests` | codebase | medium | Investigator, both engineers, QA Reviewer |
| `edit_worktree` | codebase | medium | both engineers only |
| `create_branch` | github | medium | both engineers only |
| `comment_issue_or_pr` | github | medium | engineers and reviewers |
| `create_pull_request` | github | high | both engineers — **human approval required** |
| `database_write` | database | high | **denied to every role** |
| `direct_main_push` | github | high | **denied to every role** |
| `force_push` | github | high | **denied to every role** |
| `production_deploy` | none | high | **denied to every role** |
| `secrets_access` | none | high | **denied to every role** |

Two of eight roles can change a file. None can write a database, push to the
default branch, force push, deploy, or read a secret. Opening a pull request is
permitted but marked as requiring human approval, because it asks other people to
act.

## How the layers agree

The five denied capabilities use the **same identifiers** as the five permissions
`.ax/project.yaml` forces to `false`. A test asserts the two sets are identical, so
the policy vocabulary and the project contract cannot drift apart: adding a denial
in one place without the other fails the suite.

Each capability also names the project tool switch it depends on, so the tools a
role needs follow from its capabilities rather than being listed twice.

## Rules the definitions encode

- Anything not listed for a role is denied. There is no implicit grant.
- A role may not claim a capability the policy denies to all agents; the registry
  refuses to load such a definition.
- Human approval is a property of the capability, not a per-role exception.
- v1 offers no way to enable a denied capability. It is not a default to override.

The contract is `harness/schemas/policy.schema.json`; the vocabulary is
`harness/policies/default/policy.json`.

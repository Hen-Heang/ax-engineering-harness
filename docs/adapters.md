# Vendor adapters (v1)

An adapter is the file a vendor tool reads first, and nothing more. The reusable
concepts belong to the harness; adapters are surfaces onto it.

```text
                shared instructions
                        |
              ----------------------
              |                    |
        Codex adapter        Claude adapter
              |                    |
         AGENTS.md             CLAUDE.md
```

| Adapter | Vendor | Entrypoint | Shares |
| --- | --- | --- | --- |
| `codex` | OpenAI Codex | `AGENTS.md` | `AGENTS.md` |
| `claude` | Anthropic Claude Code | `CLAUDE.md` | `AGENTS.md` |

In this repository `AGENTS.md` is both the vendor-neutral instruction document and
the file Codex reads, so for that adapter the entrypoint and the shared document
are the same file. `CLAUDE.md` is a thin surface that defers to `AGENTS.md` rather
than restating it, and additionally imports `docs/claude-handoff.md`, which is a
session handoff rather than durable instruction.

A test asserts that every adapter's entrypoint and shared documents exist, and
that each adapter defers to `AGENTS.md`. An adapter that quietly stopped pointing
at the shared instructions would fail the suite.

## Rules

- An adapter holds no capabilities of its own. Permissions come from
  [policies](policies.md), not from which tool is being used.
- An adapter must not become a competing architecture. Renaming this project into
  a Claude harness or a Codex harness is explicitly out of scope.
- A vendor-specific instruction belongs in the adapter file. Anything reusable
  belongs in the shared documents.
- Nested projects keep their own `AGENTS.md` or `CLAUDE.md`, which apply when
  working inside them and are not overridden by the root files.

Definitions live in `harness/adapters/<id>/adapter.json`; the contract is
`harness/schemas/adapter.schema.json`.

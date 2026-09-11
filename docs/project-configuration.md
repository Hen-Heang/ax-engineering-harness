# Project configuration (v1)

Implemented: strict YAML/JSON structure validation, required-command checks,
and local context-reference checks. Experimental: the v1 contract. Planned:
profile resolution, permission evaluator, command execution, and run recording.

Use `.ax/project.yaml` inside a project. See this repository's declaration for a
complete example. `schemaVersion: 1` is required; unknown fields and coercion of
strings into booleans are rejected. All tool switches, high-impact denials,
quality flags, and limits must be explicit. Nothing is silently defaulted.

From the Harness checkout:

```sh
npm ci
npm run ax -- validate
npm run ax -- validate /path/to/another-project/.ax/project.yaml
```

Quote paths containing spaces. On Windows use a normal Windows path argument.
The CLI interprets the project root as the parent of the configuration's containing
directory: keep the file in `.ax/`. Context values use project-relative forward
slashes, even on Windows. Only Markdown references are supported initially.

## Fields

| Section | Contract |
| --- | --- |
| project | Name, `single-repo` mode, profile identifier |
| context | Optional architecture, domain, database Markdown references |
| commands | Build, lint, typecheck, test, integration_test, security declarations |
| tools | Explicit codebase, docs, GitHub, metadata-only database switches |
| permissions | Main push, force push, production deployment, DB writes, secrets access must be false |
| quality | Explicit gates; review and human approval must stay true |
| limits | 0–5 retries; 1–3600 seconds declared maximum duration |

`quality.tests` requires `commands.test`; `integration_tests` requires
`integration_test`. The other executable gate names map directly. Enabled gates
must have commands even if a future profile could supply them. Disabled gates
are not reported as passed. Review, evaluation, and approval evidence is not
implemented or checked by configuration validation.

Profile identifiers are currently syntax-checked only. `harness-tooling` names
this repository's intended future profile; it is not a resolved profile. Java,
Next.js, and full-stack profiles arrive in subsequent phases. `multi-repo` mode
is rejected until its contract and implementation exist.

## Safety and limitations

- Parsing is limited to 64 KiB; duplicate keys, aliases, unknown tags, multiple
  documents, and invalid UTF-8 files are rejected.
- Context paths cannot be absolute, URLs, or contain `.` / `..` segments. The CLI
  resolves symlinks and rejects references outside the project root. It checks
  file metadata only, never contents.
- No environment substitution, shell execution, network access, or credential
  fields are supported. Commands are opaque declarations and may still be
  dangerous: validity is not authorization or proof of safe execution.
- Limits are declarations; no execution engine currently enforces them.
- Context checks describe the filesystem at validation time. A future reader
  must recheck containment and enforce tool policy at access time.
- The parser API does not resolve files. Use `checkContextFiles` or the CLI for
  the separate reference check. Neither resolves profiles.
- Exit codes: 0 valid declaration/references, 1 validation failure, 2 usage error.
  Errors do not echo configuration values.

The authoritative contract is `harness/schemas/project.schema.json` (JSON Schema
draft-07). Regenerate the TypeScript declaration with:

```sh
npm run generate:types --workspace @ax-harness/core
```

Schema implementation follows [Ajv's JSON Schema support](https://ajv.js.org/json-schema.html).
YAML parsing uses the [yaml document API](https://eemeli.org/yaml/).

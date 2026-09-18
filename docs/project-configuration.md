# Project configuration (v1)

Implemented: strict YAML/JSON structure validation, required-command checks,
local context-reference checks, and profile resolution. Experimental: the v1
contract. Planned: permission evaluator, command execution, and run recording.

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
| project | Name, `single-repo` mode, profile identifier, optional `build_system` |
| context | Optional architecture, domain, database Markdown references |
| commands | Build, lint, typecheck, test, integration_test, security declarations |
| tools | Explicit codebase, docs, GitHub, metadata-only database switches |
| permissions | Main push, force push, production deployment, DB writes, secrets access must be false |
| quality | Explicit gates; review and human approval must stay true |
| limits | 0–5 retries; 1–3600 seconds declared maximum duration |

`quality.tests` requires `commands.test`; `integration_tests` requires
`integration_test`. The other executable gate names map directly. An enabled gate
must end up with a command: either declared here, or supplied by the profile
during resolution. A gate that neither source supplies fails. Disabled gates are
not reported as passed. Review, evaluation, and approval evidence is not
implemented or checked by configuration validation.

`project.profile` must name a built-in profile; unknown identifiers fail.
`project.build_system` is optional and only needed when several build manifests
share one root, which would otherwise be rejected as ambiguous. See
[profiles](profiles.md) for resolution, detection, and precedence rules.
`multi-repo` mode is rejected until its contract and implementation exist.

`init --write` also creates a Claude Code starter surface under `.claude/`: an
entrypoint, conservative settings, project metadata, base/security/verification
rules (including UI and accessibility), plan/develop/review/UI-review skills,
planner/developer/frontend/reviewer/QA role prompts, and a documentation index.
This is a generic foundation modelled on a mature team
workspace. It does not copy private team files, invent domain rules, connect MCP
servers, start agents, read secrets, or write databases. Existing files are kept
byte-for-byte and can be filled in or replaced deliberately by the project team.

## Safety and limitations

- Parsing is limited to 64 KiB; duplicate keys, aliases, unknown tags, multiple
  documents, and invalid UTF-8 files are rejected.
- Context paths cannot be absolute, URLs, or contain `.` / `..` segments. The CLI
  resolves symlinks and rejects references outside the project root. It checks
  file metadata only, never contents.
- No environment substitution, shell execution, network access, or credential
  fields are supported. Commands are opaque declarations and may still be
  dangerous: validity is not authorization or proof of safe execution.
- Resolution reads manifest and wrapper file names only. It never runs a wrapper,
  parses a build script, or verifies that a command exists on `PATH`.
- `limits.max_duration_seconds` is enforced per command by controlled quality
  execution. `limits.max_retries` continues to bound workflow failure transitions.
- Context checks describe the filesystem at validation time. A future reader
  must recheck containment and enforce tool policy at access time.
- `parseProject` and `loadProject` perform declaration validation only, because a
  profile may still supply commands. Use `resolveProject` for the authoritative
  check, and `checkContextFiles` for the separate reference check. The CLI runs
  all three in that order.
- Exit codes: 0 valid declaration/references, 1 validation failure, 2 usage error.
  Errors do not echo configuration values.

The authoritative contracts are `harness/schemas/project.schema.json` and
`harness/schemas/profile.schema.json` (JSON Schema draft-07). Regenerate the
TypeScript declarations with:

```sh
npm run generate:types --workspace @ax-harness/core
```

Schema implementation follows [Ajv's JSON Schema support](https://ajv.js.org/json-schema.html).
YAML parsing uses the [yaml document API](https://eemeli.org/yaml/).

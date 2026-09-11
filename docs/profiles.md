# Profiles (v1)

Implemented: the profile schema, a built-in registry, build-system detection, and
resolution of profile defaults into a project declaration. Planned: Next.js and
full-stack profiles, and any execution of the commands a profile resolves.

A profile holds the stack assumptions that must not live in Harness core. Core
knows nothing about Maven, Gradle, npm, or Spring; it reads profile data.

## What a profile may and may not do

A profile may supply a command for a quality gate the declaration omitted, and it
records architecture assumptions and limitations for reviewers.

A profile may **not** enable a gate, relax a permission, change tools, context or
limits, or mark an unavailable gate as satisfied. Resolution copies every other
section verbatim and only ever writes into `commands`.

Precedence is one-directional:

```text
declaration command  →  wins always
profile default      →  fills a gap only
neither              →  an enabled gate fails validation
```

## Resolution

```text
declaration  →  declaration validation  →  profile lookup  →  build detection
             →  runner selection  →  command merge  →  full validation
```

Declaration validation deliberately does not require commands, because a profile
may still supply them. The resolved configuration is then validated in full, so
the rule that every enabled gate has a command is never weakened — only moved to
the point where the answer is actually known.

Unknown profile identifiers fail. Identifiers are keys in an explicit registry and
are never turned into filesystem paths.

## Build-system detection

Detection looks for a profile's manifest filenames **directly in the selected
root** and never recurses, so unrelated nested projects cannot influence it.

| Evidence | Outcome |
| --- | --- |
| One build system's manifest | Resolved |
| No manifest | `buildsystem.undetected` |
| Several manifests | `buildsystem.ambiguous` — set `project.build_system` |
| `build_system` the profile lacks | `buildsystem.unsupported` |
| `build_system` with no manifest present | `buildsystem.manifest_missing` |

A manifest is evidence of build layout only. It does not prove that a framework,
JDK, plugin, or task is present, and nothing is executed to find out.

## Runner selection

If the platform's wrapper file exists in the root, its invocation form is used
(`./mvnw` or `mvnw.cmd`, `./gradlew` or `gradlew.bat`). Otherwise the profile's
fallback (`mvn`, `gradle`, `npm`) is used and reported as `path-unverified`,
because availability on `PATH` is never checked. A wrapper present on one platform
does not imply the other platform's form exists.

## Built-in profiles

| Profile | Build systems | Supplies | Status |
| --- | --- | --- | --- |
| `harness-tooling` | node | build, typecheck, test, security | Implemented |
| `java-spring` | maven, gradle | build, test | Experimental |

`java-spring` supplies no lint, typecheck, security, or integration-test default.
Java projects share no single standard command for them, and neither Maven
failsafe nor a Gradle `integrationTest` task is guaranteed to be configured.
Declare those commands explicitly when a project has them.

Definitions live in `harness/profiles/<id>/profile.json` and each one states its
own architecture assumptions and limitations. The authoritative contract is
`harness/schemas/profile.schema.json`; regenerate types after editing it:

```sh
npm run generate:types --workspace @ax-harness/core
```

## Limitations

- Resolution produces command strings; nothing runs them, and no gate result exists.
- Command arguments are whitespace-free tokens joined with single spaces, so a
  profile cannot express a command that needs quoting. Declare such commands.
- The `java-spring` profile has not been validated against the legacy Java
  projects preserved in this repository; they are never built by the workspace.
- Profiles are built-in data. Loading definitions from arbitrary paths is not
  supported and is not planned without an explicit trust model.

# Profiles (v1)

Implemented: the profile schema, a built-in registry, build-system detection,
evidence reporting, resolution of profile defaults, composed multi-area profiles,
and affected-area analysis. Planned: any execution of the commands a profile
resolves.

A profile holds the stack assumptions that must not live in Harness core. Core
knows nothing about Maven, Gradle, npm, Spring, or Next.js; it reads profile data.

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

## Built-in profiles

| Profile | Kind | Build systems | Supplies | Status |
| --- | --- | --- | --- | --- |
| `harness-tooling` | single area | node | build, typecheck, test, security | Implemented |
| `java-spring` | single area | maven, gradle | build, test | Experimental |
| `nextjs-react` | single area | node | build, security | Experimental |
| `fullstack` | composed | — | nothing | Experimental |

Each profile declares **either** `buildSystems` **or** `areas`, never both, and the
registry refuses to load a definition that breaks this.

### What the profiles deliberately do not supply

`java-spring` supplies no lint, typecheck, security, or integration-test default.
Java projects share no single standard command for them, and neither Maven failsafe
nor a Gradle `integrationTest` task is guaranteed to be configured.

`nextjs-react` supplies **only build and security**, which is fewer commands than it
first appears it should. This follows from checking what a Next.js project actually
ships rather than assuming it:

- A linter is **optional**. `create-next-app` offers ESLint, Biome, or none, so a
  `lint` script cannot be assumed.
- **No typecheck script is scaffolded.** Projects that type-check in CI generally
  need `next typegen` before `tsc --noEmit`, because route types are otherwise only
  generated during `next dev` or `next build`.
- **No test runner is scaffolded**, and Playwright is never assumed to be present.
- `next lint` is not used: it is absent from the current Next.js CLI, so linting is
  left to the project's own script.

Declare those commands in the project when it genuinely has them.

## Resolution

```text
declaration  →  declaration validation  →  profile lookup  →  build detection
             →  runner selection  →  command merge  →  full validation
```

Declaration validation deliberately does not require commands, because a profile
may still supply them. The resolved configuration is then validated in full, so the
rule that every enabled gate has a command is never weakened — only moved to the
point where the answer is actually known.

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
| `build_system` on a composed profile | `buildsystem.not_composable` |

A manifest is evidence of build layout only. It does not prove that a framework,
JDK, plugin, or task is present, and nothing is executed to find out.

## Supporting evidence

A profile may list files that support it beyond the build manifest —
`nextjs-react` lists `next.config.js`, `next.config.mjs`, and `next.config.ts`.

Resolution reports which were found and which were not, and **acts on neither**.
Evidence never selects a build system and never causes a failure, because its
absence disproves nothing: a Next.js project is perfectly valid with no config file
at all. It exists so a reader can judge confidence for themselves rather than being
told a `package.json` proves Next.js is installed.

## Runner selection

If the platform's wrapper file exists in the root, its invocation form is used
(`./mvnw` or `mvnw.cmd`, `./gradlew` or `gradlew.bat`). Otherwise the profile's
fallback (`mvn`, `gradle`, `npm`) is used and reported as `path-unverified`,
because availability on `PATH` is never checked. A wrapper present on one platform
does not imply the other platform's form exists.

## Composed profiles

`fullstack` declares **areas** rather than build systems: `backend/` resolved by
`java-spring`, `frontend/` resolved by `nextjs-react`, each with the roles that own
it. Each area is detected and resolved in its own directory, with its own runner.

A composed project has more than one build root, so:

- `buildSystem` and `runner` are undefined for the project as a whole.
- `project.build_system` is rejected rather than silently applied to one area.
- The profile **supplies no commands at all**. A composed project must declare
  commands that cover both areas, because no single command is inferable.
- A missing area directory, or an area with no build manifest, fails.

Composition is one level deep: an area profile must itself declare build systems,
so a composed profile cannot compose another. Multi-repository composition remains
unsupported and is rejected by the project schema.

## Affected areas

`analyzeImpact(resolved, changedPaths)` reports which areas a set of changed files
touches, the roles that own them, whether the change crosses the boundary, and
which paths belong to no area.

```text
backend/src/Order.java              → backend            → backend-engineer, database-reviewer
frontend/app/page.tsx               → frontend           → frontend-engineer
both of the above                   → crossesAreas: true → integration review is warranted
README.md                           → unattributed       → a human decides
```

This is **path analysis and nothing more**. It says a change reaches an area's
directory; it does not prove the other area is unaffected in behavior, because a
shared contract can be broken from one side alone. Paths belonging to no area are
reported rather than dropped, since repository-level files usually deserve
attention. A single-area project has no areas, so everything is unattributed — that
is the correct answer, not a failure.

Determining affected areas decides which roles are involved. It does **not** start
anything: no agent runs, and nothing here implies parallel execution.

## Limitations

- Resolution produces command strings; nothing runs them, and no gate result exists.
- Command arguments are whitespace-free tokens joined with single spaces, so a
  profile cannot express a command that needs quoting. Declare such commands.
- Resolution never reads `package.json` or `pom.xml` contents, so it cannot confirm
  that a declared script or plugin exists.
- The `java-spring` and `nextjs-react` profiles have not been validated against the
  legacy Java projects preserved in this repository.
- `fullstack` fixes its area directories. A repository laid out differently needs
  its own profile.
- Profiles are built-in data. Loading definitions from arbitrary paths is not
  supported and is not planned without an explicit trust model.

Definitions live in `harness/profiles/<id>/profile.json`; the contract is
`harness/schemas/profile.schema.json`. Regenerate types after editing it:

```sh
npm run generate:types --workspace @ax-harness/core
```

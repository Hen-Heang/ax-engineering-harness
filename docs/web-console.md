# AX Engineering Console (v1)

Implemented: the `apps/web` workspace package, the allowlisted catalog, and a
foundation page that renders it. Planned: navigation, architecture and workflow
diagrams, the configuration explorer, building-block pages, and the adoption
simulator.

```sh
npm run dev --workspace @ax-harness/web    # local development
npm run check                              # build, typecheck, lint, test, build web
```

Next.js collects anonymous telemetry by default. Opt out with
`npx next telemetry disable` if you prefer; nothing here does it for you, because
it writes to a machine-wide setting.

## Versions

Verified at implementation time rather than assumed:

| Package | Version | Note |
| --- | --- | --- |
| next | 16.3.4 | requires Node >= 20.9 |
| react, react-dom | 19.3.0 | satisfies Next's `^19.0.0` peer range |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | CSS-first configuration, no JS config file |
| eslint | 9.39.5 | the version `eslint-config-next` itself depends on |
| eslint-config-next | 16.3.4 | tracks the Next version |
| typescript | 5.9.3 | matches the harness package |

TypeScript 7.0.2 is published, but the harness is pinned to 5.9.3 and running two
compilers across one workspace invites differences that are hard to attribute.
ESLint 10.10.0 is likewise published, but `eslint-config-next@16.3.4` depends on
ESLint 9.39.5 directly; installing 10 produced two ESLint copies, with plugins
loaded against a different one than the runner. Pinning to 9.39.5 leaves a single
version. Both choices are revisited when the upstream packages move.

## The catalog is the allowlist

The console renders `apps/web/lib/catalog.ts` and nothing else. A definition that
is not turned into an entry there cannot be reached from the browser.

```text
harness definitions  →  @ax-harness/core exports  →  catalog.ts  →  pages
```

Two rules keep this safe, and **both are enforced by tests**:

1. **No filesystem reach.** The catalog imports only pure data and pure functions.
   It never imports the project loader, the resolver, the context checker, or any
   detection helper, because those read from disk. A test scans every shipped file
   under `app/` and `lib/` and fails if any of them references those APIs or a Node
   filesystem module.
2. **Source is rendered, not read.** What the console displays as a definition's
   source is serialized from the loaded object, not loaded from a path. There is no
   file path for a request to influence, so there is nothing to traverse.

Further tests assert that the catalog contains no absolute path, no `node_modules`
or `.env` reference, and no mention of the four preserved legacy projects; that
every entry survives a JSON round trip, since entries cross the server-to-client
boundary; and that an unknown kind or identifier — including `__proto__` — reaches
no data.

Because the catalog is built from the registries rather than written by hand, the
console cannot drift from the harness. The foundation page currently reports 29
definitions because that is how many the registries hold.

## What the console does not do

- It reads no repository file at build time or request time.
- It runs no command and records no execution.
- It exposes no server action that accepts a path.
- It publishes nothing from `AuthHub/`, `heang-api-center/`, `heang-dev-lab/`, or
  `spring-boot-lab/`, and nothing from `.ax/runs/`.
- It shows no metric that was not measured. The single run record it can display is
  labelled an example, and a test asserts every displayed run is one.

## Structure

```text
apps/web/
  app/          App Router pages, layout, and Tailwind entry
  lib/catalog.ts  the allowlist
  lib/utils.ts    cn() for shadcn primitives
  tests/        catalog and safety tests
```

Styling is Tailwind v4 with a small token set in `app/globals.css`. The full visual
language, dark mode, shadcn primitives, and Lucide icons arrive with the navigation
phase; React Flow arrives with the diagram phase. Dependencies are added in the
phase that uses them rather than up front.

## Verification

`npm run check` builds the harness package, typechecks both packages, lints the
console, runs both test suites, and builds the console. The harness checks are
unchanged by the addition of this package.

Browser testing, accessibility auditing, and responsive verification at desktop,
tablet, 428px and narrower widths arrive with the QA phase.

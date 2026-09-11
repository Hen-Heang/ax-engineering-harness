# AX Engineering Console (v1)

Implemented: every page of the console, and browser verification of all of them at
four widths with automated accessibility checks, run as part of `npm run check`.

```sh
npx playwright install chromium            # once, before the browser tests can run
npm run dev --workspace @ax-harness/web    # local development
npm run e2e                                # browser tests against a production build
npm run check                              # everything, including the browser tests
```

The browser tests serve a production build, so `check` builds before running them. If
Chromium is not installed they fail with Playwright's own message rather than being
skipped, which keeps the repository honest about its own rule that an unavailable
check is not a passing one.

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
| shadcn (radix-nova) | 4.21.0 | ships `shadcn/tailwind.css`, so it is a build dependency |
| radix-ui | 1.6.7 | primitives behind Button, Badge, Card, Separator, Sheet |
| lucide-react | 1.44.0 | icons |
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
   under `app/`, `lib/` and `components/` and fails if any of them references those
   APIs or a Node filesystem module.
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
  app/                      App Router pages, layout, and Tailwind entry
  components/ui/            shadcn primitives, generated
  components/console/       the shell, the section list, and the status badge
  lib/catalog.ts            the allowlist
  lib/navigation.ts         the section model
  lib/utils.ts              cn() for shadcn primitives
  tests/                    catalog, safety and navigation tests
```

Styling is Tailwind v4 with the shadcn token set in `app/globals.css`. React Flow
arrives with the diagram phase. Dependencies are added in the phase that renders
them rather than up front.

## Verification

`npm run check` builds the harness package, typechecks both packages, lints the
console, runs both test suites, and builds the console. The harness checks are
unchanged by the addition of this package.

The browser pass recorded below covers this phase. Systematic accessibility
auditing and automated responsive coverage across breakpoints arrive with the QA
phase.

## Navigation

The sidebar lists every section the console is meant to have from the start, so the
shape of the product is visible. **An item whose page does not exist yet carries no
href**: it is rendered as text with a `Phase N` marker and a screen-reader-only
"not yet available", never as a link to a placeholder. A test asserts that every
item with an href resolves to a real `app/**/page.tsx`, so a link cannot be added
before the page it points at.

On screens below `lg` the sidebar is replaced by a sheet behind a menu button.

## Deriving status from definitions

The Overview shows each profile's status and a breakdown per building block. Both
come from `statusBreakdown`, which counts the status **each definition declares**.
Nothing on the page is a hand-maintained list, so a definition promoted from
experimental to implemented changes the page without anyone editing it.

## Browser verification

Checked in Chrome against a production build. The extension's window resize did not
take effect on this machine — the viewport stayed at its original width across three
attempts — so the narrow layout was measured inside a 428px iframe, which gets its
own viewport for media queries.

At a 413px effective viewport:

| Check | Result |
| --- | --- |
| Horizontal overflow, sheet closed | none |
| Horizontal overflow, sheet open | none |
| Desktop sidebar | hidden |
| Mobile header and menu button | shown |
| Menu button target | 44 x 44 px |
| Sheet nav link height | 44 px minimum |
| Escape key | closes the sheet |
| Focus after closing | returned to the trigger |
| Active link | `aria-current="page"` |
| Navigation landmark | labelled "Console sections" |

Two defects were found and fixed during this pass: the menu button was 32 x 32 px,
below a comfortable touch target, and the unbuilt-section marker showed a bare
number that read as an item count rather than a phase.

Dark mode follows the viewer's system preference, applied before first paint by a
small inline script because the shadcn tokens key off a `dark` class the server
cannot know. The page stays readable in the light palette if that script does not
run.

This was a manual pass at one width on one browser. Systematic responsive and
accessibility testing across breakpoints, including automated Playwright coverage,
belongs to the QA phase.

## Building-block pages

Profiles, agents, skills, MCP and tools, and policies all render from the catalog.
`lib/definitions.ts` turns a definition into labelled sections, so a page cannot
describe a field the definition does not have, and a definition that gains a
limitation shows it without anyone editing a page.

Expansion on the list pages uses native `details`/`summary` rather than a scripted
accordion, so it works with the keyboard, works before hydration, and ships no client
JavaScript.

## Config explorer

`/config` presents the catalog as a tree, with one statically generated page per
definition at `/config/<kind>/<id>`. The route parameters come from the catalog, so
a route cannot exist for something the allowlist does not expose.

**The tree is not a filesystem.** Every branch is a catalog kind and every leaf a
definition already in the allowlist, so nothing in it can name a path on disk. The
source shown is rendered from the loaded definition, never read from a file.

## A layout bug only the browser could find

At 428px the policies page scrolled sideways by 308px even though the capability
table sat inside an `overflow-x-auto` container that was correctly clipping it.

The cause was accessibility markup. Every cell carries an `sr-only` label, and
Tailwind's `sr-only` is `position: absolute`. With no positioned ancestor inside the
scroller, those 113 elements resolved their containing block to the initial one,
escaped the scroller's clipping entirely, and extended the document to the table's
full width. Neither `min-w-0`, `max-w-full`, nor `overflow-x: clip` on an ancestor
made any difference, because the problem was not the ancestors.

Adding `relative` to the scroll container fixed it: the labels are now contained by
it and clipped with everything else. The container's `relative` is therefore
load-bearing and commented as such, and all 113 labels are retained.

## Quality, evals and runs

The four gate outcomes are rendered as distinct badges **with the word always
present**, so the difference between a pass and an unrun gate never depends on
colour. The quality page also shows, per profile, which gates that profile can
supply and which the project must declare.

The evals page scores three example judgements with the **same function the harness
uses**, so the page demonstrates the real rules rather than displaying numbers
somebody typed:

| Example | Result |
| --- | --- |
| Every criterion met | 100%, pass |
| Two criteria not judged | 70%, fail, with the unjudged criteria named |
| Full score, forbidden behaviour observed | 100%, **fail** |

The last row is the point: forbidden behaviour is disqualifying, not a deduction.

The runs page labels its record as an example twice — once in a notice above it and
once as a badge on the record itself — because a screenshot of a page should not be
able to misrepresent it. The record reports integration tests as `unavailable`
rather than passed, and states that absent measurements mean unmeasured, never zero.

## The adoption simulator

Selecting a stack shows what that profile would resolve, which gates it could supply
and which the project must declare, and for the composed profile the areas and the
roles that own them. It runs from validated configuration compiled into the page: it
resolves nothing at request time, reaches no filesystem, and starts nothing.

It also says what does **not** change. Only the profile layer varies by stack; the
eight roles, the ten procedures and the capability policy are identical whichever
stack is adopted, because the harness core is deliberately free of stack assumptions.
Pretending roles differ per stack would have been an easy and dishonest demo.

The simulator is a client component, so it declares its own view types locally rather
than importing them from a module that reaches the harness.

## Browser verification

Every page is loaded at four widths — 1440, 768, 428 and 360 CSS pixels — and checked
for three things: that the document itself never scrolls sideways, that anything wider
than the viewport sits inside a scroll container, and that the page has exactly one
`main` landmark and one `h1`. Navigation is exercised separately at the widths where
each layout exists, including the sheet opening, navigating, closing on Escape, and
returning focus to its trigger.

Accessibility is checked with axe against WCAG 2.0 and 2.1, levels A and AA, at the
widest and narrowest sizes. **axe finds a real subset of problems, not all of them.**
Passing means no automatically detectable violation; it is not a claim that the
console is fully accessible.

Which specs run at which width is decided in the Playwright config rather than by
skipping at runtime, so a spec never reports as skipped when it simply does not apply
to that layout.

### Two defects it found

Both were invisible to every earlier check and are fixed:

- **Scrollable regions were not keyboard reachable.** Every source block, and the
  capability matrix container, scrolled with a pointer but could not be focused, so
  someone navigating without a mouse could not read past the first screenful. They are
  now focusable and named.
- **The failure badge did not meet contrast.** The generator's destructive variant is a
  tint, `bg-destructive/10` with `text-destructive`, which falls below the minimum on
  this surface. A failure is the one outcome that must never be hard to read, so it is
  now solid.

### What remains unverified

Only Chromium is installed, so Firefox and WebKit are unexercised. The suite has been
run on Windows with Node 25.2.1; Linux, macOS and the recommended Node 24 runtime are
untested. Manual assistive-technology testing has not been done, and nothing has been
deployed.

## Deploying

The console has not been deployed. What follows is what a deployment would need, and
was verified locally rather than assumed.

`apps/web` imports `@ax-harness/core` from that package's compiled `dist`, which does
not exist until the harness is built. A platform that runs `next build` in `apps/web`
alone therefore fails with `Module not found: Can't resolve '@ax-harness/core'`. That
was confirmed by deleting `harness/dist` and building the app on its own.

The `vercel-build` script exists for that reason. Vercel runs it in preference to
`build` when it is present, so a project whose root directory is `apps/web` works with
no further configuration:

```json
"vercel-build": "npm run build --prefix ../.. --workspace @ax-harness/core && next build"
```

Verified from a clean state — both `harness/dist` and `apps/web/.next` removed — that
the script compiles the harness and then produces a valid build.

Other deployment facts, checked rather than assumed:

| Item | State |
| --- | --- |
| `npm ci` from the committed lockfile | 701 packages, 0 vulnerabilities |
| Node.js runtime | `engines` requires >= 24, which Vercel supports |
| Playwright in devDependencies | no postinstall, so no browser download during install |
| Runtime environment variables | none; no `process.env` in shipped code |
| Rendering | every route prerendered; no request-time data access |

### Licensing

The project is MIT licensed. The grant covers the work written here and deliberately
stops short of the preserved learning projects, which contain tutorial-derived
material the author does not hold rights to; `NOTICE` states that boundary. Nothing
from those directories reaches the console: a test asserts the catalogue never
mentions them, and `.vercelignore` keeps them out of the upload.

# Architecture and workflow visualizations (v1)

Implemented: the architecture contract, the architecture map, and the two read-only
diagrams the console renders from real definitions. Planned: the configuration
explorer and the building-block pages that these diagrams link into.

## Both diagrams come from definitions

Neither diagram is drawn by hand in the web application.

- **Workflow** is read directly from `harness/workflow/default/lifecycle.json`. Every
  state, every permitted transition, and every dashed failure path exists because the
  lifecycle declares it.
- **Architecture** is read from `harness/architecture/default/architecture.json`, a
  new versioned contract. Its nodes reference the real roles, procedures and
  capabilities they stand for, and the registry refuses to load a map that names a
  role, skill, capability or definition the harness does not have.

That cross-check is the point. A diagram that can drift from the system it describes
is worse than no diagram, because it is believed.

## What a node carries

Selecting a node shows what it is, why it exists, its responsibilities, inputs and
outputs, the roles, skills and capabilities involved, and — where the node references
one — the **real source of that definition**, rendered from the loaded object rather
than read from disk.

## Read-only by design

This is a visualization, not a diagram editor. Nodes cannot be dragged, connected or
deleted, and the delete key is disabled. A reader may pan, zoom and select.

## The text alternative is not a fallback

Every node is listed as text beneath each diagram, with the same selection behaviour.
It is always visible rather than hidden behind assistive technology, so the content
never depends on the canvas being usable. A test asserts every node carries the
detail that list renders.

## Layout

Nodes declare a `row` and a `column`; the renderer centres each row. Keeping
coordinates declarative avoids a layout engine and keeps the map reviewable as data.

`fitView` is clamped so it cannot zoom below 0.75: seeing the whole shape at once is
worth less than being able to read a node, and a long lifecycle simply does not fit a
viewport at a legible size. Beyond that the reader pans, and the text list carries
the rest.

## Two defects the browser found

Both were invisible to the test suite and were fixed here:

- React Flow's `colorMode="system"` resolved to **light** on a dark page. The diagram
  now follows the same `dark` class the rest of the console is themed by, watched with
  a `MutationObserver` so it stays in step.
- `fitView` zoomed to 1.6x instead of fitting, because it measured nodes before they
  had dimensions. Nodes now declare an explicit width and height, so the first fit is
  computed against a real bounding box.

## The client boundary

`@ax-harness/core` reaches the filesystem in its loader, resolver and detection
helpers. A client component that imports it, **directly or through any local module**,
drags `node:fs` into the browser bundle — which is exactly what happened the first
time the diagram component imported `lib/graph.ts`, and the build refused it.

The split is now explicit: `lib/graph-types.ts` holds the shapes and pure helpers a
client component may import, and `lib/graph.ts` builds the graphs on the server. The
finished graph reaches the browser as serialized props.

A test follows local imports transitively from every client component and fails if any
of them can reach the harness package, and asserts that the only modules importing it
are `lib/catalog.ts` and `lib/graph.ts`. The Phase 7 scan checked direct references
only and would not have caught this.

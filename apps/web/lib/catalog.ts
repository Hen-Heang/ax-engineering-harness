import {
  adapterIds,
  agentIds,
  capabilityMatrix,
  evalIds,
  getAdapter,
  getAgent,
  getEval,
  getProfile,
  getRun,
  getSkill,
  pipeline,
  policy,
  profileIds,
  runIds,
  skillIds,
  workflow,
  type MatrixRow,
} from '@ax-harness/core';

/**
 * The public catalog.
 *
 * Everything the console can display is assembled here, from definitions that are
 * compiled into the bundle. This module is the allowlist: a definition that is not
 * turned into an entry below cannot be reached by the browser.
 *
 * Two rules keep it safe, and both are enforced by tests:
 *
 * 1. It imports only pure data and pure functions from the harness. It never
 *    imports `loadProject`, `resolveProject`, `checkContextFiles`, or any detection
 *    helper, because those read the filesystem. The console therefore has no way to
 *    reach a repository file, a legacy project, or a local run artifact.
 * 2. Displayed source is rendered from the loaded definition rather than read from
 *    disk, so there is no file path for a request to influence.
 */

export type CatalogKind =
  | 'profile' | 'agent' | 'skill' | 'adapter'
  | 'policy' | 'pipeline' | 'workflow' | 'eval' | 'run';

export type CatalogStatus = 'implemented' | 'experimental' | 'planned';

export interface CatalogEntry<T = unknown> {
  kind: CatalogKind;
  id: string;
  title: string;
  summary: string;
  /** Null where the definition declares no status, such as the policy vocabulary. */
  status: CatalogStatus | null;
  definition: T;
  /** Rendered from the loaded definition. Never read from disk. */
  source: string;
}

function render(definition: unknown): string {
  return `${JSON.stringify(definition, null, 2)}\n`;
}

function entry<T>(
  kind: CatalogKind,
  id: string,
  title: string,
  summary: string,
  status: CatalogStatus | null,
  definition: T,
): CatalogEntry<T> {
  return { kind, id, title, summary, status, definition, source: render(definition) };
}

function required<T>(kind: CatalogKind, id: string, value: T | undefined): T {
  if (value === undefined) throw new Error(`The ${kind} "${id}" is registered but could not be read.`);
  return value;
}

const profiles = profileIds.map(id => {
  const definition = required('profile', id, getProfile(id));
  return entry('profile', id, id, definition.description, definition.status, definition);
});

const agents = agentIds.map(id => {
  const definition = required('agent', id, getAgent(id));
  return entry('agent', id, definition.name, definition.purpose, definition.status, definition);
});

const skills = skillIds.map(id => {
  const definition = required('skill', id, getSkill(id));
  return entry('skill', id, definition.name, definition.purpose, definition.status, definition);
});

const adapters = adapterIds.map(id => {
  const definition = required('adapter', id, getAdapter(id));
  return entry('adapter', id, definition.vendor, `Entrypoint ${definition.entrypoint}.`, definition.status, definition);
});

const evals = evalIds.map(id => {
  const definition = required('eval', id, getEval(id));
  return entry('eval', id, definition.title, definition.task, definition.status, definition);
});

const runs = runIds.map(id => {
  const definition = required('run', id, getRun(id));
  return entry('run', id, definition.task, `${definition.kind} run owned by ${definition.agent}.`, null, definition);
});

const policies = [
  entry('policy', policy.id, 'Capability policy', policy.description, null, policy),
];

const pipelines = [
  entry('pipeline', pipeline.id, 'Quality pipeline', pipeline.description, null, pipeline),
];

const workflows = [
  entry('workflow', workflow.id, 'Engineering lifecycle', workflow.description, null, workflow),
];

export const catalog = {
  profile: profiles,
  agent: agents,
  skill: skills,
  adapter: adapters,
  policy: policies,
  pipeline: pipelines,
  workflow: workflows,
  eval: evals,
  run: runs,
} satisfies Record<CatalogKind, CatalogEntry[]>;

export const catalogKinds = Object.keys(catalog) as CatalogKind[];

/** The capability matrix, derived from the same definitions the policy page shows. */
export const capabilities: MatrixRow[] = capabilityMatrix();

export function entriesOfKind(kind: CatalogKind): CatalogEntry[] {
  return catalog[kind];
}

/** Returns undefined for anything not in the catalog, so an unknown id cannot reach data. */
export function findEntry(kind: string, id: string): CatalogEntry | undefined {
  if (!catalogKinds.includes(kind as CatalogKind)) return undefined;
  return catalog[kind as CatalogKind].find(candidate => candidate.id === id);
}

export const catalogSummary = {
  counts: Object.fromEntries(catalogKinds.map(kind => [kind, catalog[kind].length])) as Record<CatalogKind, number>,
  total: catalogKinds.reduce((sum, kind) => sum + catalog[kind].length, 0),
} as const;

export interface StatusCount {
  status: CatalogStatus | 'unspecified';
  count: number;
}

const statusOrder: (CatalogStatus | 'unspecified')[] = ['implemented', 'experimental', 'planned', 'unspecified'];

/**
 * Counts entries by the status each definition declares.
 *
 * The console reads this rather than a hand-maintained list, so a definition whose
 * status changes is reported differently without anyone remembering to edit a page.
 */
export function statusBreakdown(kind: CatalogKind): StatusCount[] {
  const counts = new Map<CatalogStatus | 'unspecified', number>();
  for (const item of catalog[kind]) {
    const key = item.status ?? 'unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return statusOrder
    .filter(status => counts.has(status))
    .map(status => ({ status, count: counts.get(status) ?? 0 }));
}

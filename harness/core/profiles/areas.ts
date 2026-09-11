import type { ResolvedArea, ResolvedProject } from './resolve.js';

export interface AreaImpact {
  /** Areas that at least one changed path belongs to, in declaration order. */
  areas: ResolvedArea[];
  /** Roles owning the affected areas, deduplicated and sorted. */
  roles: string[];
  /** Changed paths that belong to no declared area, surfaced rather than dropped. */
  unattributed: string[];
  /** True when more than one area is affected, so the change crosses the boundary. */
  crossesAreas: boolean;
}

function normalize(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function belongsTo(area: ResolvedArea, path: string): boolean {
  return path === area.path || path.startsWith(`${area.path}/`);
}

/**
 * Determines which areas a set of changed paths touches.
 *
 * This is path analysis, and nothing more. It says a change reaches an area's
 * directory; it does not prove the other area's behavior is unaffected, because a
 * shared contract can be broken from one side alone. A path belonging to no area
 * is reported as unattributed rather than quietly ignored, since repository-level
 * files usually deserve a human's attention.
 *
 * A single-area project has no declared areas, so every path is unattributed and
 * no area is affected. That is the correct answer, not a failure.
 */
export function analyzeImpact(resolved: ResolvedProject, changedPaths: readonly string[]): AreaImpact {
  const paths = changedPaths.map(normalize).filter(path => path.length > 0);
  const areas = resolved.areas.filter(area => paths.some(path => belongsTo(area, path)));
  const unattributed = paths.filter(path => !resolved.areas.some(area => belongsTo(area, path)));
  const roles = [...new Set(areas.flatMap(area => [...area.roles]))].sort();
  return { areas, roles, unattributed, crossesAreas: areas.length > 1 };
}

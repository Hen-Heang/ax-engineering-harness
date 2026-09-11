import { Ajv } from 'ajv';
import schema from '../../schemas/profile.schema.json' with { type: 'json' };
import fullstack from '../../profiles/fullstack/profile.json' with { type: 'json' };
import harnessTooling from '../../profiles/harness-tooling/profile.json' with { type: 'json' };
import javaSpring from '../../profiles/java-spring/profile.json' with { type: 'json' };
import nextjsReact from '../../profiles/nextjs-react/profile.json' with { type: 'json' };
import type { ProfileDefinition } from '../../config/profile.generated.js';
import { agentIds } from '../agents/registry.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<ProfileDefinition>(schema);

/**
 * Built-in definitions are validated when this module loads, so a malformed profile
 * fails immediately instead of resolving into a project. Profile identifiers are keys
 * in this explicit map and are never turned into filesystem paths.
 */
function register(id: string, source: unknown): ProfileDefinition {
  if (!validateSchema(source)) {
    throw new Error(`Built-in profile "${id}" does not satisfy the profile schema.`);
  }
  if (source.id !== id) {
    throw new Error(`Built-in profile "${id}" declares a different identifier.`);
  }
  if ((source.buildSystems === undefined) === (source.areas === undefined)) {
    throw new Error(`Profile "${id}" must declare either buildSystems or areas, and not both.`);
  }
  return source;
}

const definitions = new Map<string, ProfileDefinition>([
  ['fullstack', register('fullstack', fullstack)],
  ['harness-tooling', register('harness-tooling', harnessTooling)],
  ['java-spring', register('java-spring', javaSpring)],
  ['nextjs-react', register('nextjs-react', nextjsReact)],
]);

/**
 * Cross-profile invariants, checked once every definition is loaded. Composition is
 * deliberately one level deep: an area profile must resolve a real build system, so
 * a composed profile cannot compose another composed profile.
 */
for (const [id, profile] of definitions) {
  for (const area of profile.areas ?? []) {
    const areaProfile = definitions.get(area.profile);
    if (!areaProfile) {
      throw new Error(`Profile "${id}" area "${area.id}" names unknown profile "${area.profile}".`);
    }
    if (!areaProfile.buildSystems) {
      throw new Error(`Profile "${id}" area "${area.id}" composes "${area.profile}", which declares no build systems.`);
    }
    for (const role of area.roles) {
      if (!agentIds.includes(role)) {
        throw new Error(`Profile "${id}" area "${area.id}" names unknown role "${role}".`);
      }
    }
  }
}

/** Identifiers of every profile this build can resolve. */
export const profileIds: readonly string[] = [...definitions.keys()].sort();

/** Returns undefined for unknown identifiers; resolution turns that into a failure. */
export function getProfile(id: string): ProfileDefinition | undefined {
  return definitions.get(id);
}

/** A composed profile resolves several areas and supplies no commands of its own. */
export function isComposed(profile: ProfileDefinition): boolean {
  return profile.areas !== undefined;
}

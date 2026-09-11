import { Ajv } from 'ajv';
import schema from '../../schemas/profile.schema.json' with { type: 'json' };
import harnessTooling from '../../profiles/harness-tooling/profile.json' with { type: 'json' };
import javaSpring from '../../profiles/java-spring/profile.json' with { type: 'json' };
import type { ProfileDefinition } from '../../config/profile.generated.js';

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
  return source;
}

const definitions = new Map<string, ProfileDefinition>([
  ['harness-tooling', register('harness-tooling', harnessTooling)],
  ['java-spring', register('java-spring', javaSpring)],
]);

/** Identifiers of every profile this build can resolve. */
export const profileIds: readonly string[] = [...definitions.keys()].sort();

/** Returns undefined for unknown identifiers; resolution turns that into a failure. */
export function getProfile(id: string): ProfileDefinition | undefined {
  return definitions.get(id);
}

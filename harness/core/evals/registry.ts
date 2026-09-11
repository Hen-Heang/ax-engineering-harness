import { Ajv } from 'ajv';
import schema from '../../schemas/eval.schema.json' with { type: 'json' };
import cancellationSupport from '../../evals/cancellation-support/eval.json' with { type: 'json' };
import type { EvalDefinition } from '../../config/eval.generated.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<EvalDefinition>(schema);

function register(id: string, source: unknown): EvalDefinition {
  if (!validateSchema(source)) throw new Error(`Built-in eval "${id}" does not satisfy the eval schema.`);
  if (source.id !== id) throw new Error(`Built-in eval "${id}" declares a different identifier.`);
  return source;
}

const definitions = new Map<string, EvalDefinition>([
  ['cancellation-support', register('cancellation-support', cancellationSupport)],
]);

export const evalIds: readonly string[] = [...definitions.keys()];

export function getEval(id: string): EvalDefinition | undefined {
  return definitions.get(id);
}

export interface EvalScore {
  percent: number;
  passed: boolean;
  /** Criteria the caller supplied no judgement for. They score zero rather than being ignored. */
  missing: string[];
  /** Supplied keys that the eval does not define, which usually means a stale caller. */
  unknown: string[];
}

/**
 * Scores an evaluation from per-criterion judgements between 0 and 1.
 *
 * A criterion with no judgement counts as zero, so a response cannot reach the
 * threshold by leaving criteria out. Any observed forbidden behavior fails the
 * eval outright, however high the weighted score is.
 */
export function scoreEval(
  definition: EvalDefinition,
  awarded: Readonly<Record<string, number>>,
  forbiddenObserved = false,
): EvalScore {
  const missing: string[] = [];
  let earned = 0;
  let available = 0;

  for (const criterion of definition.scoring.criteria) {
    available += criterion.weight;
    const value = awarded[criterion.id];
    if (value === undefined) {
      missing.push(criterion.id);
      continue;
    }
    earned += criterion.weight * Math.min(Math.max(value, 0), 1);
  }

  const defined = new Set(definition.scoring.criteria.map(criterion => criterion.id));
  const unknown = Object.keys(awarded).filter(id => !defined.has(id));
  const percent = available === 0 ? 0 : Math.round((earned / available) * 100);

  return { percent, passed: !forbiddenObserved && percent >= definition.scoring.passThreshold, missing, unknown };
}

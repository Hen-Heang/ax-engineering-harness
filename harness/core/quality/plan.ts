import { Ajv } from 'ajv';
import schema from '../../schemas/pipeline.schema.json' with { type: 'json' };
import defaultPipeline from '../../quality/default/pipeline.json' with { type: 'json' };
import type { PipelineDefinition } from '../../config/pipeline.generated.js';
import type { CommandSource, ResolvedProject } from '../profiles/resolve.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<PipelineDefinition>(schema);

function load(source: unknown): PipelineDefinition {
  if (!validateSchema(source)) throw new Error('The built-in pipeline does not satisfy the pipeline schema.');
  for (const stage of source.stages) {
    const executable = stage.kind === 'executable';
    if (executable !== (stage.command !== undefined)) {
      throw new Error(`Pipeline stage "${stage.id}" must declare a command if and only if it is executable.`);
    }
  }
  return source;
}

export const pipeline: PipelineDefinition = load(defaultPipeline);

export type Stage = PipelineDefinition['stages'][number];

/** Whether a gate can be attempted at all. Readiness is not a result. */
export type GateReadiness = 'ready' | 'unavailable' | 'manual' | 'not-applicable';

/**
 * The outcome of a gate. `unavailable` and `unrun` are deliberately distinct from
 * `passed`: a gate nobody could run, and a gate nobody did run, have not passed.
 */
export type GateOutcome = 'passed' | 'failed' | 'unavailable' | 'unrun';

export interface GatePlan {
  stage: Stage;
  readiness: GateReadiness;
  command?: string;
  commandSource?: CommandSource;
}

export interface GateStatus {
  stage: string;
  outcome: GateOutcome;
}

/** Plans the pipeline for a resolved project. Planning runs nothing. */
export function planQuality(resolved: ResolvedProject): GatePlan[] {
  return pipeline.stages.map(stage => {
    if (!resolved.config.quality[stage.quality]) return { stage, readiness: 'not-applicable' as const };
    if (stage.kind !== 'executable' || !stage.command) return { stage, readiness: 'manual' as const };
    const resolvedCommand = resolved.commands[stage.command];
    if (!resolvedCommand) return { stage, readiness: 'unavailable' as const };
    return {
      stage,
      readiness: 'ready' as const,
      command: resolvedCommand.command,
      commandSource: resolvedCommand.source,
    };
  });
}

/**
 * Starting outcomes for a plan. Every applicable gate begins `unrun`, except one
 * with no command, which begins `unavailable`. Nothing here has passed, and no
 * component in this repository can currently change that.
 */
export function initialStatuses(plan: readonly GatePlan[]): GateStatus[] {
  return plan
    .filter(entry => entry.readiness !== 'not-applicable')
    .map(entry => ({
      stage: entry.stage.id,
      outcome: entry.readiness === 'unavailable' ? 'unavailable' as const : 'unrun' as const,
    }));
}

/**
 * True only when every applicable gate actually passed. An empty pipeline is not a
 * pass, so a configuration that gates nothing cannot report success by default.
 */
export function pipelinePassed(statuses: readonly GateStatus[]): boolean {
  return statuses.length > 0 && statuses.every(status => status.outcome === 'passed');
}

export function summarize(statuses: readonly GateStatus[]): Record<GateOutcome, number> {
  const counts: Record<GateOutcome, number> = { passed: 0, failed: 0, unavailable: 0, unrun: 0 };
  for (const status of statuses) counts[status.outcome] += 1;
  return counts;
}

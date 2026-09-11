import { Ajv } from 'ajv';
import agentSchema from '../../schemas/agent.schema.json' with { type: 'json' };
import skillSchema from '../../schemas/skill.schema.json' with { type: 'json' };
import adapterSchema from '../../schemas/adapter.schema.json' with { type: 'json' };
import backendEngineer from '../../agents/backend-engineer/agent.json' with { type: 'json' };
import databaseReviewer from '../../agents/database-reviewer/agent.json' with { type: 'json' };
import frontendEngineer from '../../agents/frontend-engineer/agent.json' with { type: 'json' };
import integrationReviewer from '../../agents/integration-reviewer/agent.json' with { type: 'json' };
import investigator from '../../agents/investigator/agent.json' with { type: 'json' };
import planner from '../../agents/planner/agent.json' with { type: 'json' };
import qaReviewer from '../../agents/qa-reviewer/agent.json' with { type: 'json' };
import securityReviewer from '../../agents/security-reviewer/agent.json' with { type: 'json' };
import backendReview from '../../skills/backend-review/skill.json' with { type: 'json' };
import debugSkill from '../../skills/debug/skill.json' with { type: 'json' };
import frontendReview from '../../skills/frontend-review/skill.json' with { type: 'json' };
import handoff from '../../skills/handoff/skill.json' with { type: 'json' };
import implementFeature from '../../skills/implement-feature/skill.json' with { type: 'json' };
import investigate from '../../skills/investigate/skill.json' with { type: 'json' };
import planFeature from '../../skills/plan-feature/skill.json' with { type: 'json' };
import securityReview from '../../skills/security-review/skill.json' with { type: 'json' };
import sqlReview from '../../skills/sql-review/skill.json' with { type: 'json' };
import testSkill from '../../skills/test/skill.json' with { type: 'json' };
import claudeAdapter from '../../adapters/claude/adapter.json' with { type: 'json' };
import codexAdapter from '../../adapters/codex/adapter.json' with { type: 'json' };
import type { AgentDefinition } from '../../config/agent.generated.js';
import type { SkillDefinition } from '../../config/skill.generated.js';
import type { AdapterDefinition } from '../../config/adapter.generated.js';
import { capabilityIds, deniedCapabilityIds } from '../permissions/policy.js';

const ajv = new Ajv({ allErrors: true, strict: true });
const validateAgent = ajv.compile<AgentDefinition>(agentSchema);
const validateSkill = ajv.compile<SkillDefinition>(skillSchema);
const validateAdapter = ajv.compile<AdapterDefinition>(adapterSchema);

function register<T extends { id: string }>(
  kind: string,
  id: string,
  source: unknown,
  validate: (value: unknown) => value is T,
): T {
  if (!validate(source)) throw new Error(`Built-in ${kind} "${id}" does not satisfy its schema.`);
  if (source.id !== id) throw new Error(`Built-in ${kind} "${id}" declares a different identifier.`);
  return source;
}

const skills = new Map<string, SkillDefinition>(([
  ['backend-review', backendReview], ['debug', debugSkill], ['frontend-review', frontendReview],
  ['handoff', handoff], ['implement-feature', implementFeature], ['investigate', investigate],
  ['plan-feature', planFeature], ['security-review', securityReview], ['sql-review', sqlReview],
  ['test', testSkill],
] as const).map(([id, source]) => [id, register('skill', id, source, validateSkill)]));

const agents = new Map<string, AgentDefinition>(([
  ['backend-engineer', backendEngineer], ['database-reviewer', databaseReviewer],
  ['frontend-engineer', frontendEngineer], ['integration-reviewer', integrationReviewer],
  ['investigator', investigator], ['planner', planner], ['qa-reviewer', qaReviewer],
  ['security-reviewer', securityReviewer],
] as const).map(([id, source]) => [id, register('agent', id, source, validateAgent)]));

const adapters = new Map<string, AdapterDefinition>(([
  ['claude', claudeAdapter], ['codex', codexAdapter],
] as const).map(([id, source]) => [id, register('adapter', id, source, validateAdapter)]));

/**
 * Cross-definition invariants. Exported as a pure function so the guard itself is
 * testable rather than assumed, and called at module load so an inconsistent
 * definition fails immediately instead of being discovered by a reader later.
 */
export function consistencyErrors(
  agentsById: ReadonlyMap<string, AgentDefinition>,
  skillsById: ReadonlyMap<string, SkillDefinition>,
  capabilities: readonly string[],
  denied: readonly string[],
): string[] {
  const errors: string[] = [];
  for (const [id, skill] of skillsById) {
    for (const capability of skill.capabilities) {
      if (!capabilities.includes(capability)) {
        errors.push(`Skill "${id}" requires capability "${capability}", which the policy does not define.`);
      }
    }
  }
  for (const [id, agent] of agentsById) {
    for (const capability of agent.capabilities) {
      if (!capabilities.includes(capability)) {
        errors.push(`Agent "${id}" claims capability "${capability}", which the policy does not define.`);
      }
      if (denied.includes(capability)) {
        errors.push(`Agent "${id}" claims "${capability}", which the policy denies to every agent.`);
      }
    }
    for (const skillId of agent.skills) {
      const skill = skillsById.get(skillId);
      if (!skill) {
        errors.push(`Agent "${id}" lists unknown skill "${skillId}".`);
        continue;
      }
      for (const capability of skill.capabilities) {
        if (!agent.capabilities.includes(capability)) {
          errors.push(`Agent "${id}" lists skill "${skillId}" but lacks its capability "${capability}".`);
        }
      }
    }
  }
  return errors;
}

const inconsistencies = consistencyErrors(agents, skills, capabilityIds, deniedCapabilityIds);
if (inconsistencies.length) throw new Error(inconsistencies[0]);

export const agentIds: readonly string[] = [...agents.keys()];
export const skillIds: readonly string[] = [...skills.keys()];
export const adapterIds: readonly string[] = [...adapters.keys()];

export function getAgent(id: string): AgentDefinition | undefined {
  return agents.get(id);
}

export function getSkill(id: string): SkillDefinition | undefined {
  return skills.get(id);
}

export function getAdapter(id: string): AdapterDefinition | undefined {
  return adapters.get(id);
}

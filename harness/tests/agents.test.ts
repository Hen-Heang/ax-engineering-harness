import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import projectSchema from '../schemas/project.schema.json' with { type: 'json' };
import {
  adapterIds, agentIds, can, capabilityIds, capabilityMatrix, consistencyErrors, deniedCapabilityIds,
  getAdapter, getAgent, getCapability, getSkill, requiredTools, skillIds,
  type AgentDefinition, type SkillDefinition,
} from '../index.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const statuses = ['implemented', 'experimental', 'planned'];

function agent(id: string): AgentDefinition {
  const definition = getAgent(id);
  if (!definition) throw new Error(`Missing agent: ${id}`);
  return definition;
}

function skill(id: string): SkillDefinition {
  const definition = getSkill(id);
  if (!definition) throw new Error(`Missing skill: ${id}`);
  return definition;
}

test('the brief roles and procedures are all registered under their own identifiers', () => {
  assert.equal(agentIds.length, 8);
  assert.equal(skillIds.length, 10);
  assert.equal(adapterIds.length, 2);
  for (const id of agentIds) {
    assert.equal(agent(id).id, id);
    assert.ok(statuses.includes(agent(id).status));
  }
  for (const id of skillIds) {
    assert.equal(skill(id).id, id);
    assert.ok(statuses.includes(skill(id).status));
  }
});

test('every capability an agent or skill names exists in the policy vocabulary', () => {
  for (const id of agentIds) {
    for (const capability of agent(id).capabilities) {
      assert.ok(getCapability(capability), `${id} claims unknown capability ${capability}`);
    }
  }
  for (const id of skillIds) {
    for (const capability of skill(id).capabilities) {
      assert.ok(getCapability(capability), `${id} needs unknown capability ${capability}`);
    }
  }
});

test('no agent claims a capability the policy denies to every agent', () => {
  assert.ok(deniedCapabilityIds.length > 0);
  for (const id of agentIds) {
    for (const denied of deniedCapabilityIds) {
      assert.equal(can(id, denied), false, `${id} must not hold ${denied}`);
    }
  }
});

test('an agent holds every capability the skills it lists require', () => {
  for (const id of agentIds) {
    for (const skillId of agent(id).skills) {
      assert.ok(skillIds.includes(skillId), `${id} lists unknown skill ${skillId}`);
      for (const capability of skill(skillId).capabilities) {
        assert.ok(can(id, capability), `${id} lists ${skillId} but lacks ${capability}`);
      }
    }
  }
});

test('denied capabilities match the high-impact permissions the project schema forbids', () => {
  const permissions = Object.keys(projectSchema.properties.permissions.properties);
  assert.deepEqual([...deniedCapabilityIds].sort(), [...permissions].sort());
});

test('roles do not duplicate one another', () => {
  const signatures = agentIds.map(id => {
    const definition = agent(id);
    return JSON.stringify([[...definition.capabilities].sort(), [...definition.skills].sort()]);
  });
  assert.equal(new Set(signatures).size, signatures.length, 'two roles have identical capabilities and skills');
});

test('the capability matrix covers the vocabulary and leaves denied rows empty', () => {
  const matrix = capabilityMatrix();
  assert.deepEqual(matrix.map(row => row.capability.id), [...capabilityIds]);
  for (const row of matrix) {
    if (row.capability.deniedToAllAgents) assert.deepEqual(row.agents, [], row.capability.id);
    else assert.ok(row.agents.length > 0, `${row.capability.id} is granted to no role`);
  }
});

test('required tools follow from the capabilities a role holds', () => {
  assert.deepEqual(requiredTools('database-reviewer'), ['codebase', 'database', 'docs', 'github']);
  assert.deepEqual(requiredTools('planner'), ['codebase', 'docs', 'github']);
  assert.deepEqual(requiredTools('unknown-role'), []);
});

test('capability questions answer false for unknown roles and unknown capabilities', () => {
  assert.equal(can('unknown-role', 'read_code'), false);
  assert.equal(can('planner', 'not_a_capability'), false);
  assert.equal(can('planner', 'read_code'), true);
  assert.equal(can('planner', 'edit_worktree'), false);
});

test('each adapter points at files that exist and shares the vendor-neutral instructions', async () => {
  for (const id of adapterIds) {
    const adapter = getAdapter(id);
    if (!adapter) throw new Error(`Missing adapter: ${id}`);
    for (const path of [adapter.entrypoint, ...adapter.sharedInstructions]) {
      assert.ok((await stat(join(repositoryRoot, path))).isFile(), `${id} references missing ${path}`);
    }
    assert.ok(adapter.sharedInstructions.includes('AGENTS.md'), `${id} must defer to the shared instructions`);
  }
});

test('the consistency guard rejects definitions that the built-ins are careful to avoid', () => {
  const base = agent('planner');
  const skills = new Map([['plan-feature', skill('plan-feature')], ['handoff', skill('handoff')]]);
  const capabilities = ['read_code', 'read_docs', 'github_read', 'database_write'];
  const denied = ['database_write'];

  assert.deepEqual(consistencyErrors(new Map([['planner', base]]), skills, capabilities, denied), []);

  const cases: Array<[string, AgentDefinition, RegExp]> = [
    ['unknown capability', { ...base, capabilities: ['not_a_capability'] }, /does not define/],
    ['denied capability', { ...base, capabilities: [...base.capabilities, 'database_write'] }, /denies to every agent/],
    ['unknown skill', { ...base, skills: ['no-such-skill'] }, /unknown skill/],
    ['skill without its capability', { ...base, capabilities: ['read_code'] }, /lacks its capability/],
  ];
  for (const [label, broken, expected] of cases) {
    const errors = consistencyErrors(new Map([['planner', broken]]), skills, capabilities, denied);
    assert.ok(errors.length > 0, label);
    assert.match(errors[0] ?? '', expected, label);
  }
});

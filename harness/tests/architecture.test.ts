import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agentIds, architecture, architectureErrors, capabilityIds, getArchitectureNode, skillIds,
  type ArchitectureDefinition,
} from '../index.js';

function clone(): ArchitectureDefinition {
  return structuredClone(architecture);
}

test('the architecture map loads and describes a connected flow', () => {
  assert.equal(architecture.schemaVersion, 1);
  assert.ok(architecture.nodes.length >= 2);
  assert.ok(architecture.edges.length >= 1);
  assert.deepEqual(architectureErrors(architecture), []);

  // Every node is reachable through some edge, so nothing floats unexplained.
  const connected = new Set(architecture.edges.flatMap(edge => [edge.from, edge.to]));
  for (const node of architecture.nodes) assert.ok(connected.has(node.id), `${node.id} is connected`);
});

test('every node explains itself and points only at definitions that exist', () => {
  for (const node of architecture.nodes) {
    assert.equal(getArchitectureNode(node.id)?.id, node.id);
    assert.ok(node.summary.length > 0, `${node.id} summary`);
    assert.ok(node.why.length > 0, `${node.id} why`);
    assert.ok(node.responsibilities.length > 0, `${node.id} responsibilities`);
    assert.ok(node.inputs.length > 0, `${node.id} inputs`);
    assert.ok(node.outputs.length > 0, `${node.id} outputs`);
    for (const agent of node.agents ?? []) assert.ok(agentIds.includes(agent), `${node.id} role ${agent}`);
    for (const skill of node.skills ?? []) assert.ok(skillIds.includes(skill), `${node.id} skill ${skill}`);
    for (const capability of node.capabilities ?? []) {
      assert.ok(capabilityIds.includes(capability), `${node.id} capability ${capability}`);
    }
  }
});

test('the map records the failure and feedback paths, not only the happy one', () => {
  const kinds = new Set(architecture.edges.map(edge => edge.kind));
  assert.ok(kinds.has('flow'));
  assert.ok(kinds.has('failure'), 'a map without failure paths would flatter the design');
  assert.ok(kinds.has('feedback'));
});

test('the guard rejects a map that describes something the harness does not define', () => {
  const broken: Array<[string, (map: ArchitectureDefinition) => void, RegExp]> = [
    ['unknown role', map => { map.nodes[0]!.agents = ['not-a-role']; }, /unknown role/],
    ['unknown skill', map => { map.nodes[0]!.skills = ['not-a-skill']; }, /unknown skill/],
    ['unknown capability', map => { map.nodes[0]!.capabilities = ['not_a_capability']; }, /unknown capability/],
    ['missing reference', map => { map.nodes[0]!.reference = { kind: 'agent', id: 'nobody' }; }, /references missing/],
    ['edge to nowhere', map => { map.edges[0]!.to = 'nowhere'; }, /unknown node/],
    ['self edge', map => { map.edges[0]!.to = map.edges[0]!.from; }, /points at itself/],
    ['duplicate node', map => { map.nodes.push(structuredClone(map.nodes[0]!)); }, /more than once/],
  ];

  for (const [label, breakIt, expected] of broken) {
    const map = clone();
    breakIt(map);
    const errors = architectureErrors(map);
    assert.ok(errors.length > 0, label);
    assert.match(errors.join(' '), expected, label);
  }
});

test('an orphan node is reported rather than drawn floating', () => {
  const map = clone();
  map.nodes.push({
    ...structuredClone(map.nodes[0]!),
    id: 'orphan',
    row: 20,
    column: 0,
  });
  assert.match(architectureErrors(map).join(' '), /not connected/);
});

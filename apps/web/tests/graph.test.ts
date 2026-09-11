import assert from 'node:assert/strict';
import { test } from 'node:test';
import { architecture, workflow } from '@ax-harness/core';
import { architectureGraph, workflowGraph } from '../lib/graph';
import { rowsOf, type Graph } from '../lib/graph-types';

const graphs: [string, Graph][] = [
  ['architecture', architectureGraph],
  ['workflow', workflowGraph],
];

test('both diagrams are derived from harness definitions, not drawn by hand', () => {
  assert.deepEqual(
    architectureGraph.nodes.map(node => node.id),
    architecture.nodes.map(node => node.id),
  );
  assert.equal(architectureGraph.edges.length, architecture.edges.length);

  assert.deepEqual(
    workflowGraph.nodes.map(node => node.id),
    workflow.states.map(state => state.id),
  );
  const expectedEdges =
    workflow.states.reduce((sum, state) => sum + state.next.length, 0) +
    workflow.states.filter(state => state.onFailure !== undefined).length;
  assert.equal(workflowGraph.edges.length, expectedEdges);
});

test('every edge connects nodes that exist in the same graph', () => {
  for (const [name, graph] of graphs) {
    const ids = new Set(graph.nodes.map(node => node.id));
    for (const edge of graph.edges) {
      assert.ok(ids.has(edge.from), `${name}: edge from ${edge.from}`);
      assert.ok(ids.has(edge.to), `${name}: edge to ${edge.to}`);
    }
    assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length, `${name}: edge ids unique`);
  }
});

test('every node carries the detail the text alternative renders', () => {
  for (const [name, graph] of graphs) {
    assert.ok(graph.nodes.length > 0, name);
    for (const node of graph.nodes) {
      assert.ok(node.title.length > 0, `${name}/${node.id} title`);
      assert.ok(node.summary.length > 0, `${name}/${node.id} summary`);
      assert.ok(node.sections.length > 0, `${name}/${node.id} sections`);
      for (const part of node.sections) {
        assert.ok(part.items.length > 0, `${name}/${node.id} section ${part.label}`);
      }
    }
  }
});

test('a node that references a definition carries that definition real source', () => {
  const referencing = architectureGraph.nodes.filter(node => node.reference !== null);
  assert.ok(referencing.length > 0, 'some nodes should link to a definition');
  for (const node of referencing) {
    assert.ok(node.source, `${node.id} should carry source`);
    // The source is the rendered definition, so it parses back to an object.
    const parsed = JSON.parse(node.source ?? '') as { id?: string };
    assert.equal(parsed.id, node.reference?.id, `${node.id} source matches its reference`);
  }
});

test('the workflow diagram keeps the failure paths the lifecycle declares', () => {
  const failures = workflowGraph.edges.filter(edge => edge.kind === 'failure');
  const declared = workflow.states.filter(state => state.onFailure !== undefined);
  assert.equal(failures.length, declared.length);
  assert.ok(failures.length > 0, 'the lifecycle declares failure paths and the diagram must show them');
  for (const state of declared) {
    assert.ok(
      failures.some(edge => edge.from === state.id && edge.to === state.onFailure),
      `${state.id} failure path`,
    );
  }
});

test('graphs are serializable, because they cross the server-to-client boundary', () => {
  for (const [name, graph] of graphs) {
    assert.deepEqual(JSON.parse(JSON.stringify(graph)), graph, name);
  }
});

test('rows are ordered for layout without losing a node', () => {
  for (const [name, graph] of graphs) {
    const rows = rowsOf(graph);
    assert.equal(rows.flat().length, graph.nodes.length, name);
    const rowNumbers = rows.map(row => row[0]?.row ?? -1);
    assert.deepEqual(rowNumbers, [...rowNumbers].sort((a, b) => a - b), `${name}: rows ascend`);
    for (const row of rows) {
      const columns = row.map(node => node.column);
      assert.deepEqual(columns, [...columns].sort((a, b) => a - b), `${name}: columns ascend`);
    }
  }
});

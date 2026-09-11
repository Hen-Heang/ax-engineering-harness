import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProfile, pipeline, policy } from '@ax-harness/core';
import {
  evalThreshold, exampleOutcomes, gateOutcomes, gateViews, simulations, stackNeutral,
} from '../lib/simulation';

test('the gate views are the pipeline, in the order it declares', () => {
  assert.deepEqual(gateViews.map(gate => gate.id), pipeline.stages.map(stage => stage.id));
  for (const gate of gateViews) {
    const stage = pipeline.stages.find(candidate => candidate.id === gate.id);
    assert.equal(gate.title, stage?.title);
    assert.equal(gate.kind, stage?.kind);
    assert.equal(gate.command, stage?.command ?? null);
  }
});

test('the four outcomes are fixed, so a page cannot invent a fifth', () => {
  assert.deepEqual(gateOutcomes.map(outcome => outcome.id), ['passed', 'failed', 'unavailable', 'unrun']);
  for (const outcome of gateOutcomes) assert.ok(outcome.meaning.length > 0);
});

test('each simulated stack is derived from its profile definition', () => {
  assert.deepEqual(simulations.map(simulation => simulation.id), ['java-spring', 'nextjs-react', 'fullstack']);
  for (const simulation of simulations) {
    const profile = getProfile(simulation.id);
    assert.ok(profile, simulation.id);
    assert.equal(simulation.summary, profile.description);
    assert.equal(simulation.status, profile.status);
    assert.deepEqual(simulation.limitations, profile.limitations);
    assert.equal(simulation.gates.length, pipeline.stages.length);
  }
});

test('a gate is marked supplied only when the profile really supplies that command', () => {
  for (const simulation of simulations) {
    const profile = getProfile(simulation.id);
    const supplied = new Set(
      Object.values(profile?.buildSystems ?? {}).flatMap(system => Object.keys(system?.commands ?? {})),
    );
    for (const gate of simulation.gates) {
      const stage = pipeline.stages.find(candidate => candidate.id === gate.id);
      if (stage?.kind === 'human') assert.equal(gate.source, 'manual', gate.id);
      else if (stage?.kind === 'eval') assert.equal(gate.source, 'eval', gate.id);
      else if (stage?.command !== undefined && supplied.has(stage.command)) {
        assert.equal(gate.source, 'profile', `${simulation.id}/${gate.id}`);
      } else {
        assert.equal(gate.source, 'project', `${simulation.id}/${gate.id}`);
      }
    }
  }
});

test('the composed stack supplies nothing and names the roles that own each area', () => {
  const fullstack = simulations.find(simulation => simulation.id === 'fullstack');
  assert.ok(fullstack);
  assert.deepEqual(fullstack.buildSystems, []);
  assert.equal(fullstack.gates.some(gate => gate.source === 'profile'), false);
  assert.deepEqual(fullstack.areas.map(area => area.id), ['backend', 'frontend']);
  for (const area of fullstack.areas) assert.ok(area.roles.length > 0, area.id);
});

test('the Next.js stack shows the gates its project must declare', () => {
  const nextjs = simulations.find(simulation => simulation.id === 'nextjs-react');
  assert.ok(nextjs);
  const supplied = nextjs.gates.filter(gate => gate.source === 'profile').map(gate => gate.id);
  assert.deepEqual(supplied, ['build', 'security']);
  const declared = nextjs.gates.filter(gate => gate.source === 'project').map(gate => gate.id);
  assert.deepEqual(declared, ['lint', 'typecheck', 'unit_tests', 'integration_tests']);
});

test('the example outcomes demonstrate the scoring rules rather than asserting results', () => {
  assert.equal(exampleOutcomes.length, 3);

  const [everything, omitted, forbidden] = exampleOutcomes;

  assert.equal(everything?.percent, 100);
  assert.equal(everything?.passed, true);
  assert.deepEqual(everything?.missing, []);

  // An unjudged criterion scores zero and is named, so omission cannot reach the bar.
  assert.ok((omitted?.percent ?? 100) < evalThreshold);
  assert.equal(omitted?.passed, false);
  assert.ok((omitted?.missing.length ?? 0) > 0);

  // Forbidden behaviour is disqualifying, not a deduction.
  assert.equal(forbidden?.percent, 100);
  assert.equal(forbidden?.passed, false);
});

test('roles and denials do not vary by stack', () => {
  assert.equal(stackNeutral.roles.length, 8);
  assert.equal(stackNeutral.skillCount, 10);
  assert.deepEqual(
    [...stackNeutral.deniedCapabilities].sort(),
    policy.capabilities.filter(c => c.deniedToAllAgents).map(c => c.id).sort(),
  );
});

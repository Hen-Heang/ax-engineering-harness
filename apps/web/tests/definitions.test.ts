import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalog, catalogKinds } from '../lib/catalog';
import { detailFor, detailsOfKind } from '../lib/definitions';

test('every catalog entry has a detail, and the detail keeps its identity', () => {
  for (const kind of catalogKinds) {
    const details = detailsOfKind(kind);
    assert.equal(details.length, catalog[kind].length, kind);
    details.forEach((detail, index) => {
      const entry = catalog[kind][index];
      assert.equal(detail.id, entry?.id);
      assert.equal(detail.kind, kind);
      assert.equal(detail.title, entry?.title);
      assert.equal(detail.status, entry?.status);
      assert.equal(detail.source, entry?.source);
    });
  }
});

test('sections are read from the definition rather than written on a page', () => {
  const planner = detailFor('agent', 'planner');
  assert.ok(planner);
  const labels = planner.sections.map(section => section.label);
  assert.deepEqual(labels, [
    'Responsibilities', 'Required context', 'Capabilities', 'Procedures it follows',
    'Must never', 'Inputs', 'Outputs', 'Escalates when',
  ]);
  // The values come from the definition, so they match its own arrays.
  const definition = catalog.agent.find(entry => entry.id === 'planner')?.definition as {
    responsibilities: string[]; forbidden: string[];
  };
  assert.deepEqual(planner.sections[0]?.items, definition.responsibilities);
  assert.deepEqual(planner.sections.find(s => s.label === 'Must never')?.items, definition.forbidden);
});

test('a procedure records its steps in order, because sequence is part of the meaning', () => {
  const investigate = detailFor('skill', 'investigate');
  assert.ok(investigate);
  const steps = investigate.sections.find(section => section.label === 'Steps');
  assert.ok(steps, 'a skill must show its steps');
  assert.equal(steps.ordered, true);
  const definition = catalog.skill.find(entry => entry.id === 'investigate')?.definition as { steps: string[] };
  assert.deepEqual(steps.items, definition.steps);
});

test('a profile reports what it supplies and what it refuses to assume', () => {
  const nextjs = detailFor('profile', 'nextjs-react');
  assert.ok(nextjs);
  const labels = nextjs.sections.map(section => section.label);
  assert.ok(labels.includes('Build systems'));
  assert.ok(labels.includes('Limitations'), 'limitations must be shown, not buried');

  const supplies = nextjs.sections.find(section => section.label === 'Build systems')?.items.join(' ');
  assert.match(supplies ?? '', /supplies build, security/);

  const composed = detailFor('profile', 'fullstack');
  assert.ok(composed);
  assert.ok(composed.sections.some(section => section.label === 'Composed areas'));
});

test('an unmeasured run value is described as unmeasured rather than shown as zero', () => {
  const run = detailFor('run', 'example-cancellation');
  assert.ok(run);
  const measurements = run.sections.find(section => section.label === 'Measurements');
  assert.ok(measurements);
  assert.match(measurements.items.join(' '), /unmeasured, never zero/);
});

test('an unknown kind or identifier reaches no detail', () => {
  assert.equal(detailFor('agent', 'nobody'), undefined);
  assert.equal(detailFor('not-a-kind', 'planner'), undefined);
  assert.equal(detailFor('__proto__', 'planner'), undefined);
  assert.equal(detailFor('constructor', 'planner'), undefined);
});

test('every section that exists has content, so no empty headings render', () => {
  for (const kind of catalogKinds) {
    for (const detail of detailsOfKind(kind)) {
      for (const section of detail.sections) {
        assert.ok(section.label.length > 0, `${kind}/${detail.id} label`);
        assert.ok(section.items.length > 0, `${kind}/${detail.id} section ${section.label} is empty`);
      }
    }
  }
});

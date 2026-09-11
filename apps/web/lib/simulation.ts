import { getEval, getProfile, pipeline, policy, scoreEval, type ProfileDefinition } from '@ax-harness/core';
import { catalog } from './catalog';

/**
 * Data for the quality, evals and adoption pages.
 *
 * Everything here is computed from the definitions. The eval outcomes are produced by
 * the real scorer over example judgements, so they demonstrate the actual rules rather
 * than displaying numbers somebody typed. No evaluation has been run, and nothing here
 * claims one has.
 */

export type GateSource = 'profile' | 'project' | 'manual' | 'eval';

export interface GateView {
  id: string;
  title: string;
  kind: string;
  description: string;
  /** Command slot the stage reads, for executable stages only. */
  command: string | null;
}

export const gateViews: GateView[] = pipeline.stages.map(stage => ({
  id: stage.id,
  title: stage.title,
  kind: stage.kind,
  description: stage.description,
  command: stage.command ?? null,
}));

/** Outcomes a gate can report. Kept together so a page cannot invent a fifth. */
export const gateOutcomes = [
  { id: 'passed', meaning: 'The command ran and succeeded.' },
  { id: 'failed', meaning: 'The command ran and did not succeed.' },
  { id: 'unavailable', meaning: 'No command exists for an applicable gate. Nobody could run it.' },
  { id: 'unrun', meaning: 'A command exists, but it was not run.' },
] as const;

function suppliedSlots(profile: ProfileDefinition): Set<string> {
  const slots = new Set<string>();
  for (const system of Object.values(profile.buildSystems ?? {})) {
    for (const slot of Object.keys(system?.commands ?? {})) slots.add(slot);
  }
  return slots;
}

export interface SimulatedGate {
  id: string;
  title: string;
  source: GateSource;
  detail: string;
}

export interface SimulatedBuildSystem {
  id: string;
  manifests: string[];
  runner: string;
  supplies: string[];
}

export interface SimulatedArea {
  id: string;
  title: string;
  path: string;
  profile: string;
  roles: string[];
}

export interface Simulation {
  id: string;
  label: string;
  summary: string;
  status: string;
  buildSystems: SimulatedBuildSystem[];
  areas: SimulatedArea[];
  gates: SimulatedGate[];
  limitations: string[];
}

function simulate(profileId: string, label: string): Simulation {
  const profile = getProfile(profileId);
  if (!profile) throw new Error(`The adoption simulator references unknown profile "${profileId}".`);
  const supplied = suppliedSlots(profile);

  return {
    id: profile.id,
    label,
    summary: profile.description,
    status: profile.status,
    buildSystems: Object.entries(profile.buildSystems ?? {}).map(([id, system]) => ({
      id,
      manifests: [...(system?.manifests ?? [])],
      runner: system?.runner.wrapper
        ? `${system.runner.wrapper.posix.command} or ${system.runner.fallback}`
        : (system?.runner.fallback ?? ''),
      supplies: Object.keys(system?.commands ?? {}),
    })),
    areas: (profile.areas ?? []).map(area => ({
      id: area.id,
      title: area.title,
      path: area.path,
      profile: area.profile,
      roles: [...area.roles],
    })),
    gates: gateViews.map(gate => {
      if (gate.kind === 'human') {
        return { id: gate.id, title: gate.title, source: 'manual' as const, detail: 'A person decides. Cannot be disabled.' };
      }
      if (gate.kind === 'eval') {
        return { id: gate.id, title: gate.title, source: 'eval' as const, detail: 'Assesses behaviour, not software.' };
      }
      if (gate.command !== null && supplied.has(gate.command)) {
        return { id: gate.id, title: gate.title, source: 'profile' as const, detail: `The profile supplies ${gate.command}.` };
      }
      return {
        id: gate.id,
        title: gate.title,
        source: 'project' as const,
        detail: `The project must declare ${gate.command}, or the gate stays unavailable.`,
      };
    }),
    limitations: [...profile.limitations],
  };
}

export const simulations: Simulation[] = [
  simulate('java-spring', 'Spring Boot service'),
  simulate('nextjs-react', 'Next.js application'),
  simulate('fullstack', 'Full-stack repository'),
];

/** Roles and policy do not vary by stack; only the profile layer does. */
export const stackNeutral = {
  roles: catalog.agent.map(agent => ({ id: agent.id, title: agent.title })),
  skillCount: catalog.skill.length,
  deniedCapabilities: policy.capabilities.filter(c => c.deniedToAllAgents).map(c => c.id),
};

export interface ExampleOutcome {
  label: string;
  note: string;
  percent: number;
  passed: boolean;
  missing: string[];
}

const cancellation = getEval('cancellation-support');

function exampleOutcome(
  label: string,
  note: string,
  awarded: Record<string, number>,
  forbiddenObserved = false,
): ExampleOutcome {
  if (!cancellation) throw new Error('The evals page references an eval this build does not hold.');
  const score = scoreEval(cancellation, awarded, forbiddenObserved);
  return { label, note, percent: score.percent, passed: score.passed, missing: score.missing };
}

const everyCriterion = Object.fromEntries(
  (cancellation?.scoring.criteria ?? []).map(criterion => [criterion.id, 1]),
);

/**
 * Example judgements, scored by the real scorer.
 *
 * These are illustrations of the scoring rules, not results. No agent has been
 * evaluated, and every one of these is labelled an example where it is displayed.
 */
export const exampleOutcomes: ExampleOutcome[] = [
  exampleOutcome(
    'Every criterion met',
    'The straightforward case: full weight, above the threshold.',
    everyCriterion,
  ),
  exampleOutcome(
    'Two criteria not judged',
    'An unjudged criterion scores zero and is reported, so a response cannot reach the threshold by omission.',
    { locates_owner: 1, preserves_rules: 1, adds_tests: 1 },
  ),
  exampleOutcome(
    'Full score, but forbidden behaviour observed',
    'Forbidden behaviour is disqualifying rather than a deduction, however high the weighted score.',
    everyCriterion,
    true,
  ),
];

export const evalThreshold = cancellation?.scoring.passThreshold ?? 0;

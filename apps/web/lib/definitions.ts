import type {
  AdapterDefinition, AgentDefinition, EvalDefinition, PipelineDefinition, PolicyDefinition,
  ProfileDefinition, RunRecord, SkillDefinition, WorkflowDefinition,
} from '@ax-harness/core';
import { catalog, type CatalogEntry, type CatalogKind, type CatalogStatus } from './catalog';

/**
 * Turns a definition into the labelled sections every page renders.
 *
 * Each section is read from the definition itself, so a page cannot describe a field
 * the definition does not have, and a definition that gains a limitation shows it
 * without anyone editing a page. This module imports the harness and is server-only.
 */

export interface DetailSection {
  label: string;
  items: string[];
  /** Rendered as an ordered list where sequence is part of the meaning. */
  ordered?: boolean;
}

export interface DefinitionDetail {
  kind: CatalogKind;
  id: string;
  title: string;
  summary: string;
  status: CatalogStatus | null;
  sections: DetailSection[];
  source: string;
}

function part(label: string, items: readonly string[] | undefined, ordered = false): DetailSection[] {
  if (!items || items.length === 0) return [];
  return [ordered ? { label, items: [...items], ordered } : { label, items: [...items] }];
}

function profileSections(definition: ProfileDefinition): DetailSection[] {
  const buildSystems = Object.entries(definition.buildSystems ?? {}).map(([name, system]) => {
    const supplied = Object.keys(system?.commands ?? {});
    const wrapper = system?.runner.wrapper ? 'wrapper or ' : '';
    return `${name}: detected by ${system?.manifests.join(', ')}; runs via ${wrapper}${system?.runner.fallback}; supplies ${supplied.length > 0 ? supplied.join(', ') : 'nothing'}`;
  });

  const areas = (definition.areas ?? []).map(
    area => `${area.id}: ${area.path}/ resolved by ${area.profile}, owned by ${area.roles.join(', ')}`,
  );

  return [
    ...part('Build systems', buildSystems),
    ...part('Composed areas', areas),
    ...part('Detection evidence', definition.evidence),
    ...part('Architecture assumptions', definition.architecture),
    ...part('Limitations', definition.limitations),
  ];
}

function agentSections(definition: AgentDefinition): DetailSection[] {
  return [
    ...part('Responsibilities', definition.responsibilities),
    ...part('Required context', definition.requiredContext),
    ...part('Capabilities', definition.capabilities),
    ...part('Procedures it follows', definition.skills),
    ...part('Must never', definition.forbidden),
    ...part('Inputs', definition.inputs),
    ...part('Outputs', definition.outputs),
    ...part('Escalates when', definition.escalation),
  ];
}

function skillSections(definition: SkillDefinition): DetailSection[] {
  return [
    ...part('Prerequisites', definition.prerequisites),
    ...part('Steps', definition.steps, true),
    ...part('Capabilities needed', definition.capabilities),
    ...part('Outputs', definition.outputs),
    ...part('Verification', definition.verification),
    ...part('Escalates when', definition.escalation),
  ];
}

function adapterSections(definition: AdapterDefinition): DetailSection[] {
  return [
    ...part('Entrypoint', [definition.entrypoint]),
    ...part('Shared instructions', definition.sharedInstructions),
    ...part('Notes', definition.notes),
  ];
}

function evalSections(definition: EvalDefinition): DetailSection[] {
  return [
    ...part('Expected behaviour', definition.expectedBehaviors),
    ...part('Forbidden behaviour', definition.forbiddenBehaviors),
    ...part('Required concepts', definition.requiredConcepts),
    ...part('Quality requirements', definition.qualityRequirements),
    ...part('Scoring', definition.scoring.criteria.map(c => `${c.title} (weight ${c.weight})`)),
    ...part('Pass threshold', [`${definition.scoring.passThreshold}% of the available weight`]),
    ...part('Notes', definition.notes),
  ];
}

function policySections(definition: PolicyDefinition): DetailSection[] {
  const denied = definition.capabilities.filter(c => c.deniedToAllAgents).map(c => c.title);
  const approval = definition.capabilities.filter(c => c.humanApproval).map(c => c.title);
  return [
    ...part('Capabilities defined', definition.capabilities.map(c => `${c.id} — ${c.title}`)),
    ...part('Denied to every role', denied),
    ...part('Requires human approval', approval),
  ];
}

function pipelineSections(definition: PipelineDefinition): DetailSection[] {
  return part('Stages, in order', definition.stages.map(s => `${s.title} (${s.kind}) — ${s.description}`), true);
}

function workflowSections(definition: WorkflowDefinition): DetailSection[] {
  return [
    ...part('States, in order', definition.states.map(s => {
      const failure = s.onFailure ? `, returns to ${s.onFailure} on failure` : '';
      return `${s.title} → ${s.next.length > 0 ? s.next.join(', ') : 'terminal'}${failure}`;
    }), true),
  ];
}

function runSections(definition: RunRecord): DetailSection[] {
  const measured = definition.measurements ?? {};
  const measurements = Object.entries(measured).map(([key, value]) => `${key}: ${value}`);
  return [
    ...part('Gate outcomes', definition.gates.map(g => `${g.stage}: ${g.outcome}`)),
    ...part('Files read', definition.filesRead),
    ...part('Files changed', definition.filesChanged),
    ...part('Tools used', definition.tools),
    ...part('Measurements', measurements.length > 0 ? measurements : ['None recorded. Absent means unmeasured, never zero.']),
    ...part('Notes', definition.notes),
  ];
}

function sectionsFor(entry: CatalogEntry): DetailSection[] {
  switch (entry.kind) {
    case 'profile': return profileSections(entry.definition as ProfileDefinition);
    case 'agent': return agentSections(entry.definition as AgentDefinition);
    case 'skill': return skillSections(entry.definition as SkillDefinition);
    case 'adapter': return adapterSections(entry.definition as AdapterDefinition);
    case 'eval': return evalSections(entry.definition as EvalDefinition);
    case 'policy': return policySections(entry.definition as PolicyDefinition);
    case 'pipeline': return pipelineSections(entry.definition as PipelineDefinition);
    case 'workflow': return workflowSections(entry.definition as WorkflowDefinition);
    case 'run': return runSections(entry.definition as RunRecord);
    default: return [];
  }
}

function toDetail(entry: CatalogEntry): DefinitionDetail {
  return {
    kind: entry.kind,
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    status: entry.status,
    sections: sectionsFor(entry),
    source: entry.source,
  };
}

/** Every definition of a kind, as the detail pages render it. */
export function detailsOfKind(kind: CatalogKind): DefinitionDetail[] {
  return catalog[kind].map(toDetail);
}

/** Undefined for anything outside the catalog, so an unknown id reaches no data. */
export function detailFor(kind: string, id: string): DefinitionDetail | undefined {
  const kinds = Object.keys(catalog) as CatalogKind[];
  if (!kinds.includes(kind as CatalogKind)) return undefined;
  const entry = catalog[kind as CatalogKind].find(candidate => candidate.id === id);
  return entry ? toDetail(entry) : undefined;
}

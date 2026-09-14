import { loadProject } from '../../config/load.js';
import { checkContextFiles } from '../context/resolve.js';
import { resolveProject } from '../profiles/resolve.js';
import { evalIds } from '../evals/registry.js';
import { detectCapabilities } from '../capability/detect.js';
import { parseCommand } from '../execution/command-parser.js';
import { resolveExecutable } from '../execution/executable.js';
import { authorize } from '../permissions/authorize.js';
import { EXECUTION_CAPABILITY, type QualityActor } from '../quality/execute.js';
import { planQuality } from '../quality/plan.js';
import type { ConfigIssue } from '../../config/validate.js';
import type { ProjectConfig } from '../../config/project.generated.js';

/**
 * Reporting whether a project is ready to use the harness.
 *
 * The diagnostic is deliberately factual. It states what is declared, what exists on
 * disk, and what the harness could start if asked — never a readiness percentage,
 * which would put a number on a judgement nobody made and invite the number to be
 * improved rather than the project.
 *
 * Nothing here executes a project command. It looks up whether a declared program
 * exists — the same `stat` the runner does before spawning, which starts no process —
 * and reads manifests under a byte ceiling to see what the project appears able to
 * run. Reading a manifest is not interpreting one: no build file is evaluated. That
 * distinction matters, because `ax doctor` must be safe to run against a repository
 * you have not read.
 */

/** A declared context document, and whether the reference resolves. */
export interface ContextFinding {
  key: string;
  path: string;
  status: 'present' | 'missing';
  /** Why the reference failed, when it did. */
  code?: string;
}

export type CommandAvailability =
  /** Declared, parses, and the program exists on this machine. */
  | 'available'
  /** Declared and parses, but the program is not installed here. */
  | 'not-installed'
  /** Declared, but written in a form v1 will not run. */
  | 'unsupported'
  /**
   * The gate is enabled but neither project nor profile supplies a command.
   * Defensive: validation refuses such a declaration outright, so in practice this
   * surfaces as a configuration failure rather than as a gate state.
   */
  | 'not-configured'
  /** The gate is switched off in the declaration. */
  | 'disabled'
  /** The gate is carried out by a person, so no command applies. */
  | 'manual';

export interface QualityFinding {
  stage: string;
  title: string;
  availability: CommandAvailability;
  command?: string;
  /** Whether the command came from the declaration or the profile. */
  source?: string;
  /**
   * Evidence that the project can run this gate although the declaration switched it
   * off. Present only on a disabled gate, and only when something was observed.
   */
  unclaimed?: string;
}

export interface ToolFinding {
  id: string;
  enabled: boolean;
  /** Present only for the database tool, which is metadata-only in v1. */
  mode?: string;
}

export interface DoctorReport {
  /** Absolute root the declaration was read against. */
  root: string;
  configuration: { status: 'pass' | 'fail'; issues: ConfigIssue[] };
  /** Everything below is absent when the configuration did not load or resolve. */
  project?: string;
  profile?: { id: string; status: string };
  context: ContextFinding[];
  buildSystem?: { id: string; selection: 'declared' | 'detected'; runner?: string; wrapper: boolean };
  /** Named build roots, for a composed profile that has more than one. */
  areas: { id: string; path: string; buildSystem: string }[];
  quality: QualityFinding[];
  tools: ToolFinding[];
  evals: number;
  execution?: {
    /** Gates the harness could start right now. */
    runnable: number;
    /** Gates that are enabled and expect a command. */
    expected: number;
    /** Whether the person running this may execute at all, and why not. */
    authorization: string;
  };
  recommendations: string[];
}

const CONTEXT_KEYS = ['architecture', 'domain', 'database'] as const;

function toolFindings(config: ProjectConfig): ToolFinding[] {
  return [
    { id: 'codebase', enabled: config.tools.codebase.enabled },
    { id: 'docs', enabled: config.tools.docs.enabled },
    { id: 'github', enabled: config.tools.github.enabled },
    { id: 'database', enabled: config.tools.database.enabled, mode: config.tools.database.mode },
  ];
}

export interface DoctorOptions {
  /** Path to the declaration. The project root is its parent's parent. */
  file: string;
  root: string;
  /** Who would run the gates. Reported, never acted on. */
  actor: QualityActor;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

/**
 * Inspects a project and reports what the harness can see.
 *
 * A declaration that will not load or resolve is itself the finding, so this returns
 * a report rather than throwing: the case where a project is *not* ready is the one
 * this command exists for.
 */
export async function inspectProject(options: DoctorOptions): Promise<DoctorReport> {
  const base: DoctorReport = {
    root: options.root,
    configuration: { status: 'pass', issues: [] },
    context: [],
    areas: [],
    quality: [],
    tools: [],
    evals: evalIds.length,
    recommendations: [],
  };

  const loaded = await loadProject(options.file);
  if (!loaded.valid) {
    const absent = loaded.issues.some(issue => issue.code === 'file.missing');
    return {
      ...base,
      configuration: { status: 'fail', issues: loaded.issues },
      recommendations: [
        absent
          ? 'This project has not adopted the harness yet. Add .ax/project.yaml to begin.'
          : 'Fix the declaration before anything else. Nothing below can be inspected until it loads.',
      ],
    };
  }

  const config = loaded.config;
  const resolution = await resolveProject(config, { root: options.root });
  if (!resolution.valid) {
    return {
      ...base,
      configuration: { status: 'fail', issues: resolution.issues },
      project: config.project.name,
      tools: toolFindings(config),
      context: await contextFindings(config, options.root),
      recommendations: ['Resolution failed, so no command is known. The issues above name the cause.'],
    };
  }

  const resolved = resolution.resolved;
  const context = await contextFindings(config, options.root);

  /*
   * What the project looks able to run, regardless of what it declared. A gate that
   * is switched off in a project that plainly can run it is a declaration
   * under-reporting its own project, and saying nothing about it would be a clean
   * report that describes less than the truth.
   */
  const capabilities = await detectCapabilities(options.root, resolved.buildSystem);
  const byStage = new Map(capabilities.map(entry => [entry.stage, entry.evidence]));
  const quality: QualityFinding[] = [];

  for (const entry of planQuality(resolved)) {
    const finding: QualityFinding = {
      stage: entry.stage.id,
      title: entry.stage.title,
      availability: 'disabled',
    };
    if (entry.readiness === 'not-applicable') {
      finding.availability = 'disabled';
      const evidence = byStage.get(entry.stage.id);
      if (evidence) finding.unclaimed = evidence;
    } else if (entry.readiness === 'manual') finding.availability = 'manual';
    else if (entry.readiness === 'unavailable') finding.availability = 'not-configured';
    else if (entry.command !== undefined) {
      finding.command = entry.command;
      if (entry.commandSource) finding.source = entry.commandSource;
      const parsed = parseCommand(entry.command);
      if (!parsed.supported) {
        finding.availability = 'unsupported';
      } else {
        // A lookup, not a launch. This is the same check the runner makes before
        // spawning, and it starts nothing.
        const file = await resolveExecutable(parsed.command.program, {
          cwd: options.root,
          ...(options.env === undefined ? {} : { env: options.env }),
          ...(options.platform === undefined ? {} : { platform: options.platform }),
        });
        finding.availability = file === null ? 'not-installed' : 'available';
      }
    }
    quality.push(finding);
  }

  const expected = quality.filter(entry => !['disabled', 'manual'].includes(entry.availability)).length;
  const runnable = quality.filter(entry => entry.availability === 'available').length;
  const decision = authorize({ actor: options.actor, capability: EXECUTION_CAPABILITY, project: config });

  const report: DoctorReport = {
    ...base,
    project: config.project.name,
    profile: { id: resolved.profile.id, status: resolved.profile.status },
    context,
    areas: resolved.areas.map(area => ({ id: area.id, path: area.path, buildSystem: area.buildSystem })),
    quality,
    tools: toolFindings(config),
    execution: {
      runnable,
      expected,
      authorization: decision.outcome === 'denied' ? `${decision.outcome} (${decision.reason})` : decision.outcome,
    },
    recommendations: [],
  };

  if (resolved.buildSystem && resolved.runner) {
    report.buildSystem = {
      id: resolved.buildSystem,
      selection: config.project.build_system ? 'declared' : 'detected',
      runner: resolved.runner.command,
      wrapper: resolved.runner.availability === 'wrapper-present',
    };
  }

  report.recommendations = recommend(report, context);
  return report;
}

async function contextFindings(config: ProjectConfig, root: string): Promise<ContextFinding[]> {
  const issues = await checkContextFiles(config, root);
  const byKey = new Map(issues.map(issue => [issue.path.replace('/context/', ''), issue]));
  return CONTEXT_KEYS.filter(key => config.context[key] !== undefined).map(key => {
    const issue = byKey.get(key);
    return {
      key,
      path: config.context[key] as string,
      status: issue ? ('missing' as const) : ('present' as const),
      ...(issue ? { code: issue.code } : {}),
    };
  });
}

/**
 * Turns findings into things a person could do next.
 *
 * Each recommendation names something observed above, so none of them is advice the
 * report cannot justify. A project with nothing to fix gets an empty list rather
 * than filler.
 */
function recommend(report: DoctorReport, context: ContextFinding[]): string[] {
  const recommendations: string[] = [];

  for (const key of CONTEXT_KEYS) {
    if (!context.some(entry => entry.key === key)) {
      recommendations.push(`Add ${key} context, which no declaration references.`);
    }
  }
  for (const entry of context.filter(item => item.status === 'missing')) {
    recommendations.push(`Fix the ${entry.key} context reference; ${entry.path} does not resolve to a file.`);
  }
  for (const entry of report.quality.filter(item => item.availability === 'not-configured')) {
    recommendations.push(`Configure a command for ${entry.title}, which is enabled but has none.`);
  }
  for (const entry of report.quality.filter(item => item.availability === 'unsupported')) {
    recommendations.push(`Rewrite the ${entry.title} command without shell syntax, or it can never run.`);
  }
  for (const entry of report.quality.filter(item => item.availability === 'not-installed')) {
    recommendations.push(`Install the tool for ${entry.title}, or run elsewhere; its program was not found here.`);
  }
  /*
   * The finding this diagnostic exists to avoid getting wrong. A project that can run
   * a gate it switched off is not in good shape, and must not be told it is.
   */
  for (const entry of report.quality.filter(item => item.unclaimed !== undefined)) {
    recommendations.push(
      `Enable ${entry.title}: it is switched off, but ${entry.unclaimed}. Declare its command to run it.`,
    );
  }
  if (report.evals === 0) recommendations.push('Add a first agent eval; none is defined.');
  if (report.execution && report.execution.authorization !== 'allowed') {
    recommendations.push(`Execution is ${report.execution.authorization}, so no gate would run.`);
  }
  return recommendations;
}

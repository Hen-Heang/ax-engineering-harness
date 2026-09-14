import { dirname, join, resolve } from 'node:path';
import { loadProject } from '../config/load.js';
import { checkContextFiles } from '../core/context/resolve.js';
import { resolveProject } from '../core/profiles/resolve.js';
import { capabilityMatrix } from '../core/permissions/decide.js';
import { initialStatuses, pipelinePassed, planQuality, summarize } from '../core/quality/plan.js';
import {
  authorizeExecution, EXECUTION_CAPABILITY, executeQualityPlan,
  type QualityActor, type QualityGateResult,
} from '../core/quality/execute.js';
import { buildRunRecord } from '../core/observability/run.js';
import { persistRunRecord } from '../core/observability/storage.js';
import { inspectProject, type DoctorReport } from '../core/doctor/inspect.js';
import { planInit } from '../core/init/plan.js';
import { applyInit } from '../core/init/apply.js';
import type { ConfigIssue } from '../config/validate.js';

const usage = [
  'Usage: npm run ax -- validate [path/to/.ax/project.yaml]',
  '       npm run ax -- quality [--execute] [path/to/.ax/project.yaml]',
  '       npm run ax -- policy',
  '       npm run ax -- doctor [path/to/.ax/project.yaml]',
  '       npm run ax -- init [--write] [--profile <id>] [--name <name>] [directory]',
].join('\n');

async function resolveFrom(argument: string | undefined) {
  const file = resolve(argument ?? '.ax/project.yaml');
  const root = resolve(dirname(file), '..');
  const loaded = await loadProject(file);
  if (!loaded.valid) return { ok: false as const, issues: loaded.issues };
  const resolution = await resolveProject(loaded.config, { root });
  if (!resolution.valid) return { ok: false as const, issues: resolution.issues };
  return { ok: true as const, resolved: resolution.resolved, root };
}

function describeRunner(availability: string): string {
  return availability === 'wrapper-present'
    ? 'wrapper present, not executed'
    : 'no wrapper; falls back to PATH, which was not verified';
}

function report(issues: ConfigIssue[]): void {
  for (const issue of issues) console.error(`${issue.path} [${issue.code}] ${issue.message}`);
  process.exitCode = 1;
}

async function validate(argument: string | undefined): Promise<void> {
  const outcome = await resolveFrom(argument);
  if (!outcome.ok) return report(outcome.issues);

  const { root } = outcome;
  const { profile, buildSystem, runner, commands, config, areas, evidence } = outcome.resolved;
  const context = await checkContextFiles(config, root);
  if (context.length) return report(context);

  console.log('Valid project configuration and context references.');
  console.log(`Profile: ${profile.id} (${profile.status})`);

  if (buildSystem && runner) {
    const selected = config.project.build_system ? 'explicitly selected' : 'detected';
    console.log(`Build system: ${buildSystem} (${selected})`);
    console.log(`Runner: ${runner.command} (${describeRunner(runner.availability)})`);
  }

  for (const area of areas) {
    console.log(`Area ${area.id}: ${area.path} resolved by ${area.profile.id} (${area.buildSystem})`);
    console.log(`  runner: ${area.runner.command} (${describeRunner(area.runner.availability)})`);
    console.log(`  roles: ${area.roles.join(', ')}`);
  }

  if (evidence.found.length > 0 || evidence.missing.length > 0) {
    console.log(`Supporting evidence present: ${evidence.found.join(', ') || 'none'}`);
    if (evidence.missing.length > 0) {
      console.log(`  absent (which disproves nothing): ${evidence.missing.join(', ')}`);
    }
  }

  for (const [slot, command] of Object.entries(commands)) {
    console.log(`  ${slot} [${command.source}] ${command.command}`);
  }
  console.log(`Assumptions and limitations: harness/profiles/${profile.id}/profile.json`);
  console.log('Validation and resolution do not execute gates. No commands were run.');
}

function duration(milliseconds: number | undefined): string {
  return milliseconds === undefined ? '' : `${(milliseconds / 1000).toFixed(1)}s`;
}

function gateDetail(gate: QualityGateResult): string {
  if (gate.execution?.status === 'unsupported') {
    return `Unsupported command (${gate.execution.unsupportedReason ?? 'unsupported syntax'})`;
  }
  if (gate.reason === 'manual') return 'Manual';
  if (gate.reason === 'no-command') return 'No command configured';
  if (gate.reason === 'prior-gate-failed') return 'Not run after an earlier gate failed';
  if (gate.reason === 'executable-not-found') return 'Command not found on this machine';
  if (gate.reason === 'shell-required') {
    return 'Needs a shell to start on this platform; the harness will not start one';
  }
  if (gate.reason === 'capability-denied') return 'The acting actor may not run commands';
  if (gate.reason === 'approval-required') return 'Awaiting human approval';
  if (gate.execution?.status === 'execution-error') {
    return `Could not execute (${gate.execution.errorCode ?? 'spawn-error'})`;
  }
  return '';
}

/*
 * The CLI runs as the person who typed the command, in their own checkout. That is
 * not an agent acting under a role, and labelling it one would put a capability
 * decision in the record that nothing actually made.
 */
const CLI_ACTOR: QualityActor = { kind: 'human-cli' };

async function quality(args: string[]): Promise<void> {
  const execute = args.includes('--execute');
  const positional = args.filter(arg => !arg.startsWith('-'));
  const outcome = await resolveFrom(positional[0]);
  if (!outcome.ok) return report(outcome.issues);

  const plan = planQuality(outcome.resolved);
  if (execute) {
    const { config, profile } = outcome.resolved;
    console.log('AX Quality Run');
    console.log('');
    console.log(`Project: ${config.project.name}`);
    console.log(`Profile: ${profile.id}`);
    console.log(`Root: ${outcome.root}`);

    /*
     * Say up front whether this is allowed at all. The executor decides for itself
     * regardless — this only avoids announcing a list of commands the actor may
     * not run.
     */
    const decision = authorizeExecution(CLI_ACTOR, config);
    const actorLabel = CLI_ACTOR.kind === 'agent' ? `agent ${CLI_ACTOR.role}` : 'human at the CLI';
    console.log(`Actor: ${actorLabel}`);
    console.log(`Authorization: ${EXECUTION_CAPABILITY} ${decision.outcome}${
      decision.outcome === 'denied' ? ` (${decision.reason})` : ''}`);

    if (decision.outcome === 'allowed') {
      console.log('Commands to execute:');
      for (const entry of plan.filter(item => item.readiness === 'ready')) {
        console.log(`  ${entry.stage.title}: ${entry.command}`);
      }
      console.log(`Limits: ${config.limits.max_duration_seconds}s per command`);
    } else {
      console.log('No command will be run.');
    }
    console.log('');

    const result = await executeQualityPlan(plan, {
      root: outcome.root,
      timeoutSeconds: config.limits.max_duration_seconds,
      execute: true,
      actor: CLI_ACTOR,
      project: config,
    });
    for (const gate of result.gates) {
      console.log(gate.title.toUpperCase());
      if (gate.command) console.log(`Command: ${gate.command}`);
      console.log(`Status: ${gate.outcome.toUpperCase()}`);
      if (gate.execution) console.log(`Duration: ${duration(gate.execution.durationMs)}`);
      const detail = gateDetail(gate);
      if (detail) console.log(detail);
      console.log('');
    }
    console.log('FINAL RESULT');
    console.log(result.finalStatus.toUpperCase());

    const record = buildRunRecord({
      project: config.project.name,
      profile: profile.id,
      actor: CLI_ACTOR,
      execution: result,
    });
    if (!record.valid) return report(record.issues);
    const persisted = await persistRunRecord(outcome.root, record.record);
    if (!persisted.saved) {
      console.error(`Run record was not saved: ${persisted.code}.`);
      process.exitCode = 1;
    } else {
      console.log(`Recorded: ${persisted.file}`);
    }
    if (result.finalStatus !== 'pass') process.exitCode = 1;
    return;
  }

  const statuses = initialStatuses(plan);
  const counts = summarize(statuses);

  const scope = outcome.resolved.buildSystem ?? `${outcome.resolved.areas.length} composed areas`;
  console.log(`Quality pipeline for profile ${outcome.resolved.profile.id} (${scope}).`);
  console.log('');
  console.log(`${'stage'.padEnd(19)}${'readiness'.padEnd(16)}${'source'.padEnd(9)}command`);
  for (const entry of plan) {
    const row = `${entry.stage.id.padEnd(19)}${entry.readiness.padEnd(16)}${(entry.commandSource ?? '').padEnd(9)}${entry.command ?? ''}`;
    console.log(row.trimEnd());
  }
  console.log('');
  console.log(`Outcomes: ${counts.passed} passed, ${counts.failed} failed, ${counts.unavailable} unavailable, ${counts.unrun} unrun.`);
  console.log(`Pipeline passed: ${pipelinePassed(statuses)}.`);
  console.log('No gate was executed. Readiness is not an outcome, and unrun is not a pass.');
}

const LABELS: Record<string, string> = {
  available: 'AVAILABLE',
  'not-installed': 'NOT INSTALLED',
  unsupported: 'UNSUPPORTED',
  'not-configured': 'NOT CONFIGURED',
  disabled: 'DISABLED',
  manual: 'MANUAL',
};

function section(title: string): void {
  console.log('');
  console.log(title);
}

function row(label: string, value: string): void {
  console.log(`  ${label.padEnd(22)}${value}`);
}

function render(report: DoctorReport): void {
  console.log('AX Project Doctor');
  section('Project');
  row('name', report.project ?? 'unknown');
  row('root', report.root);
  if (report.profile) row('profile', `${report.profile.id} (${report.profile.status})`);

  section('Configuration');
  row('project.yaml', report.configuration.status.toUpperCase());
  for (const issue of report.configuration.issues) {
    console.log(`    ${issue.path} [${issue.code}] ${issue.message}`);
  }
  if (report.configuration.status === 'fail') {
    console.log('');
    console.log('Recommendations');
    for (const item of report.recommendations) console.log(`  - ${item}`);
    return;
  }

  section('Context');
  if (report.context.length === 0) console.log('  none declared');
  for (const entry of report.context) {
    row(entry.key, `${entry.status === 'present' ? 'PRESENT' : 'MISSING'}  ${entry.path}`);
  }

  section('Build system');
  if (report.buildSystem) {
    const wrapper = report.buildSystem.wrapper ? 'wrapper present' : 'no wrapper; PATH not verified';
    row(report.buildSystem.id, `${report.buildSystem.selection.toUpperCase()}  ${report.buildSystem.runner ?? ''} (${wrapper})`);
  } else if (report.areas.length > 0) {
    for (const area of report.areas) row(area.id, `${area.buildSystem}  ${area.path}`);
  } else {
    console.log('  none detected');
  }

  section('Quality');
  for (const entry of report.quality) {
    const suffix = entry.command ? `  ${entry.command}${entry.source ? ` [${entry.source}]` : ''}` : '';
    row(entry.title, `${LABELS[entry.availability] ?? entry.availability}${suffix}`);
  }

  section('Tools');
  for (const tool of report.tools) {
    row(tool.id, `${tool.enabled ? 'ENABLED' : 'DISABLED'}${tool.mode ? `  (${tool.mode})` : ''}`);
  }

  section('Evals');
  row('definitions', String(report.evals));

  if (report.execution) {
    section('Execution');
    row('runnable now', `${report.execution.runnable} of ${report.execution.expected} command gates`);
    row('authorization', report.execution.authorization);
  }

  section('Recommendations');
  if (report.recommendations.length === 0) console.log('  nothing outstanding');
  for (const item of report.recommendations) console.log(`  - ${item}`);
  console.log('');
  console.log('No project command was executed. Availability is a filesystem lookup, not a run.');
}

async function doctor(argument: string | undefined): Promise<void> {
  const file = resolve(argument ?? '.ax/project.yaml');
  const report = await inspectProject({
    file,
    root: resolve(dirname(file), '..'),
    actor: CLI_ACTOR,
  });
  render(report);
  if (report.configuration.status === 'fail') process.exitCode = 1;
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function init(args: string[]): Promise<void> {
  const write = args.includes('--write');
  const profile = flagValue(args, '--profile');
  const name = flagValue(args, '--name');
  const consumed = new Set([profile, name].filter(Boolean));
  const positional = args.filter(arg => !arg.startsWith('-') && !consumed.has(arg));
  const root = resolve(positional[0] ?? '.');

  const plan = await planInit({
    root,
    ...(profile ? { profile } : {}),
    ...(name ? { name } : {}),
  });

  console.log('AX Project Init');
  console.log('');
  console.log(`Root: ${plan.root}`);
  console.log(`Detected: ${plan.detection.manifests.join(', ') || 'no build manifest'}`);
  console.log(`Project name: ${plan.name ?? 'undetermined'}`);
  console.log(`Profile: ${plan.profile ? `${plan.profile.id} (${plan.profile.source})` : 'none'}`);
  if (plan.candidates.length > 0) console.log(`Candidates: ${plan.candidates.join(', ')}`);

  if (plan.blockers.length > 0) {
    console.log('');
    console.log('Cannot propose an adoption:');
    for (const blocker of plan.blockers) console.log(`  - ${blocker}`);
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('Files');
  for (const file of plan.files) {
    const verb = file.status === 'create' ? 'create' : 'keep  ';
    console.log(`  ${verb}  ${file.path.padEnd(28)}${file.note ?? ''}`);
  }

  if (!write) {
    console.log('');
    console.log('Nothing was written. Re-run with --write to create the files listed above.');
    console.log('Existing files are never replaced, whatever the flag says.');
    return;
  }

  const applied = await applyInit(plan);
  console.log('');
  console.log('Result');
  for (const result of applied.written) {
    console.log(`  ${result.outcome.padEnd(16)}${result.path}${result.code ? `  (${result.code})` : ''}`);
  }
  if (applied.written.some(result => result.outcome === 'failed')) {
    process.exitCode = 1;
    return;
  }
  console.log('');
  console.log(`Next: npm run ax -- doctor ${join(plan.root, '.ax', 'project.yaml')}`);
}

function showPolicy(): void {
  console.log('Capability matrix declared in harness/policies/default/policy.json.');
  console.log(`Only ${EXECUTION_CAPABILITY} is enforced, and only where an agent actor asks the`);
  console.log('quality executor to run gates. Every other row is a declaration nothing yet checks.');
  console.log('');
  console.log(`${'capability'.padEnd(21)}${'risk'.padEnd(8)}${'tool'.padEnd(10)}roles`);
  for (const { capability, agents } of capabilityMatrix()) {
    const roles = capability.deniedToAllAgents
      ? 'denied to every agent'
      : agents.join(', ') || 'no agent';
    const approval = capability.humanApproval ? ' (human approval required)' : '';
    console.log(`${capability.id.padEnd(21)}${capability.risk.padEnd(8)}${capability.tool.padEnd(10)}${roles}${approval}`);
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === 'validate' && args.length <= 1 && !args[0]?.startsWith('-')) {
  await validate(args[0]);
} else if (command === 'quality' && args.filter(arg => !arg.startsWith('-')).length <= 1
  && args.every(arg => arg === '--execute' || !arg.startsWith('-'))) {
  await quality(args);
} else if (command === 'doctor' && args.length <= 1 && !args[0]?.startsWith('-')) {
  await doctor(args[0]);
} else if (command === 'init') {
  await init(args);
} else if (command === 'policy' && args.length === 0) {
  showPolicy();
} else {
  console.error(usage);
  process.exitCode = 2;
}

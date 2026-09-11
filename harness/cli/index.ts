import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadProject } from '../config/load.js';
import { checkContextFiles } from '../core/context/resolve.js';
import { resolveProject } from '../core/profiles/resolve.js';
import { capabilityMatrix } from '../core/permissions/decide.js';
import { initialStatuses, pipelinePassed, planQuality, summarize } from '../core/quality/plan.js';
import { executeGates, EXECUTION_CAPABILITY } from '../core/execution/gates.js';
import { buildRunRecord } from '../core/observability/run.js';
import { can } from '../core/permissions/decide.js';
import type { ConfigIssue } from '../config/validate.js';

const usage = [
  'Usage: npm run ax -- validate [path/to/.ax/project.yaml]',
  '       npm run ax -- quality  [path/to/.ax/project.yaml]',
  '       npm run ax -- policy',
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
  console.log('Gate execution, agents, and evaluation are not implemented. No commands were run.');
}

async function quality(argument: string | undefined): Promise<void> {
  const outcome = await resolveFrom(argument);
  if (!outcome.ok) return report(outcome.issues);

  const plan = planQuality(outcome.resolved);
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

function showPolicy(): void {
  console.log('Capability matrix declared in harness/policies/default/policy.json.');
  console.log(`Only ${EXECUTION_CAPABILITY} is enforced, by the gate runner. The rest are declarations.`);
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

const DEFAULT_ROLE = 'qa-reviewer';

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

/**
 * Runs, or merely reports, a project's declared gates.
 *
 * Nothing is executed without --execute. That default matters: every other command
 * in this CLI is read-only, and this one should not quietly stop being so.
 */
async function runGates(args: string[]): Promise<void> {
  const positional = args.filter(arg => !arg.startsWith('-'));
  const roleFlag = flagValue(args, '--as');
  const path = positional.find(arg => arg !== roleFlag);
  const execute = args.includes('--execute');
  const agent = roleFlag ?? DEFAULT_ROLE;

  const outcome = await resolveFrom(path);
  if (!outcome.ok) return report(outcome.issues);

  const { resolved, root } = outcome;
  const report_ = await executeGates(resolved, { root, agent, execute });

  console.log(`Gates for ${resolved.profile.id}, acting as ${agent}.`);
  if (report_.denied) {
    console.log(`${agent} does not hold ${EXECUTION_CAPABILITY}, so nothing was run.`);
  } else if (!execute) {
    console.log('Reporting only. Pass --execute to run these commands.');
  }
  console.log('');
  console.log(`${'stage'.padEnd(19)}${'outcome'.padEnd(13)}${'detail'.padEnd(22)}command`);
  for (const gate of report_.gates) {
    const detail = gate.refusal ?? `exit ${gate.exitCode ?? '?'}${gate.timedOut ? ', timed out' : ''}`;
    console.log(`${gate.stage.padEnd(19)}${gate.outcome.padEnd(13)}${detail.padEnd(22)}${gate.command ?? ''}`.trimEnd());
  }

  const counts = { passed: 0, failed: 0, unavailable: 0, unrun: 0 };
  for (const gate of report_.gates) counts[gate.outcome] += 1;
  const passed = report_.gates.length > 0 && report_.gates.every(gate => gate.outcome === 'passed');
  console.log('');
  console.log(`Outcomes: ${counts.passed} passed, ${counts.failed} failed, ${counts.unavailable} unavailable, ${counts.unrun} unrun.`);
  console.log(`Pipeline passed: ${passed}.`);

  if (!report_.executed) {
    console.log('No command was executed.');
    return;
  }

  const id = `run-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
  const record = buildRunRecord({
    id,
    task: 'Run the declared quality gates.',
    agent,
    profile: resolved.profile.id,
    tools: ['codebase'],
    gates: report_.gates.map(gate => ({ stage: gate.stage, outcome: gate.outcome })),
    durationSeconds: Math.round(report_.durationMs / 1000),
    notes: [
      'Recorded by the gate runner. Only commands from the resolved configuration were run.',
      'Files read and changed are not tracked, and no tokens or cost were measured, so those stay absent.',
    ],
  });
  if (!record.valid) return report(record.issues);

  const directory = join(root, '.ax', 'runs');
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${id}.json`);
  await writeFile(file, `${JSON.stringify(record.record, null, 2)}
`, 'utf8');
  console.log(`Recorded: ${file}`);
  if (!passed) process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
if (command === 'validate' && args.length <= 1 && !args[0]?.startsWith('-')) {
  await validate(args[0]);
} else if (command === 'quality' && args.length <= 1 && !args[0]?.startsWith('-')) {
  await quality(args[0]);
} else if (command === 'run') {
  await runGates(args);
} else if (command === 'policy' && args.length === 0) {
  showPolicy();
} else {
  console.error(usage);
  process.exitCode = 2;
}

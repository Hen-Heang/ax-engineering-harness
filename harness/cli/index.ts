import { dirname, resolve } from 'node:path';
import { loadProject } from '../config/load.js';
import { checkContextFiles } from '../core/context/resolve.js';
import { resolveProject } from '../core/profiles/resolve.js';
import { capabilityMatrix } from '../core/permissions/decide.js';
import type { ConfigIssue } from '../config/validate.js';

const usage = 'Usage: npm run ax -- validate [path/to/.ax/project.yaml]\n       npm run ax -- policy';

function report(issues: ConfigIssue[]): void {
  for (const issue of issues) console.error(`${issue.path} [${issue.code}] ${issue.message}`);
  process.exitCode = 1;
}

async function validate(argument: string | undefined): Promise<void> {
  const file = resolve(argument ?? '.ax/project.yaml');
  const root = resolve(dirname(file), '..');

  const loaded = await loadProject(file);
  if (!loaded.valid) return report(loaded.issues);

  const resolution = await resolveProject(loaded.config, { root });
  if (!resolution.valid) return report(resolution.issues);

  const { profile, buildSystem, runner, commands, config } = resolution.resolved;
  const context = await checkContextFiles(config, root);
  if (context.length) return report(context);

  const selected = config.project.build_system ? 'explicitly selected' : 'detected';
  const availability = runner.availability === 'wrapper-present'
    ? 'wrapper present, not executed'
    : 'no wrapper; falls back to PATH, which was not verified';

  console.log('Valid project configuration and context references.');
  console.log(`Profile: ${profile.id} (${profile.status})`);
  console.log(`Build system: ${buildSystem} (${selected})`);
  console.log(`Runner: ${runner.command} (${availability})`);
  for (const [slot, command] of Object.entries(commands)) {
    console.log(`  ${slot} [${command.source}] ${command.command}`);
  }
  console.log(`Assumptions and limitations: harness/profiles/${profile.id}/profile.json`);
  console.log('Gate execution, agents, and evaluation are not implemented. No commands were run.');
}

function showPolicy(): void {
  console.log('Capability matrix declared in harness/policies/default/policy.json.');
  console.log('These are definitions only. Nothing enforces them and no tool access is granted.');
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
} else if (command === 'policy' && args.length === 0) {
  showPolicy();
} else {
  console.error(usage);
  process.exitCode = 2;
}

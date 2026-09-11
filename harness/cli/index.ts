import { dirname, resolve } from 'node:path';
import { loadProject } from '../config/load.js';
import { checkContextFiles } from '../core/context/resolve.js';
import { resolveProject } from '../core/profiles/resolve.js';
import type { ConfigIssue } from '../config/validate.js';

function report(issues: ConfigIssue[]): void {
  for (const issue of issues) console.error(`${issue.path} [${issue.code}] ${issue.message}`);
  process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
if (command !== 'validate' || args.length > 1 || args[0]?.startsWith('-')) {
  console.error('Usage: npm run ax -- validate [path/to/.ax/project.yaml]');
  process.exitCode = 2;
} else {
  const file = resolve(args[0] ?? '.ax/project.yaml');
  const root = resolve(dirname(file), '..');
  const loaded = await loadProject(file);
  if (!loaded.valid) {
    report(loaded.issues);
  } else {
    const resolution = await resolveProject(loaded.config, { root });
    if (!resolution.valid) {
      report(resolution.issues);
    } else {
      const { profile, buildSystem, runner, commands, config } = resolution.resolved;
      const context = await checkContextFiles(config, root);
      if (context.length) {
        report(context);
      } else {
        const selected = config.project.build_system ? 'explicitly selected' : 'detected';
        const availability = runner.availability === 'wrapper-present'
          ? 'wrapper present, not executed'
          : 'no wrapper; falls back to PATH, which was not verified';
        console.log('Valid project configuration and context references.');
        console.log(`Profile: ${profile.id} (${profile.status})`);
        console.log(`Build system: ${buildSystem} (${selected})`);
        console.log(`Runner: ${runner.command} (${availability})`);
        for (const [slot, resolved] of Object.entries(commands)) {
          console.log(`  ${slot} [${resolved.source}] ${resolved.command}`);
        }
        console.log(`Assumptions and limitations: harness/profiles/${profile.id}/profile.json`);
        console.log('Gate execution, agents, and evaluation are not implemented. No commands were run.');
      }
    }
  }
}

import { dirname, resolve } from 'node:path';
import { loadProject } from '../config/load.js';
import { checkContextFiles } from '../core/context/resolve.js';

const [command, ...args] = process.argv.slice(2);
if (command !== 'validate' || args.length > 1 || args[0]?.startsWith('-')) {
  console.error('Usage: npm run ax -- validate [path/to/.ax/project.yaml]');
  process.exitCode = 2;
} else {
  const file = resolve(args[0] ?? '.ax/project.yaml');
  const result = await loadProject(file);
  const issues = result.valid
    ? await checkContextFiles(result.config, resolve(dirname(file), '..'))
    : result.issues;
  if (issues.length) {
    for (const issue of issues) console.error(`${issue.path} [${issue.code}] ${issue.message}`);
    process.exitCode = 1;
  } else {
    console.log('Valid project configuration and context references.');
    console.log('Profile resolution and execution are not implemented. No commands were run.');
  }
}

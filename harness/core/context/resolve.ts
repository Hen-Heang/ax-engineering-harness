import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ProjectConfig } from '../../config/project.generated.js';
import { validateDeclaration, type ConfigIssue } from '../../config/validate.js';

/** Checks references without reading their contents. Does not authorize later access. */
export async function checkContextFiles(config: ProjectConfig, projectRoot: string): Promise<ConfigIssue[]> {
  const validated = validateDeclaration(config);
  if (!validated.valid) return validated.issues;
  let root: string;
  try {
    root = await realpath(projectRoot);
    if (!(await stat(root)).isDirectory()) throw new Error();
  } catch {
    return [{ path: '/context', code: 'context.root', message: 'Project root must be an existing directory.' }];
  }
  const issues: ConfigIssue[] = [];
  for (const [key, value] of Object.entries(config.context)) {
    try {
      const target = await realpath(resolve(root, value));
      const offset = relative(root, target);
      if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
        issues.push({ path: `/context/${key}`, code: 'context.outside_root', message: 'Context must resolve within the project root.' });
      } else if (!(await stat(target)).isFile()) {
        issues.push({ path: `/context/${key}`, code: 'context.not_file', message: 'Context must reference a regular file.' });
      }
    } catch {
      issues.push({ path: `/context/${key}`, code: 'context.unavailable', message: 'Context reference is missing or inaccessible.' });
    }
  }
  return issues;
}

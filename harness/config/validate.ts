import { Ajv } from 'ajv';
import schema from '../schemas/project.schema.json' with { type: 'json' };
import type { ProjectConfig } from './project.generated.js';

export interface ConfigIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult =
  | { valid: true; config: ProjectConfig }
  | { valid: false; issues: ConfigIssue[] };

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<ProjectConfig>(schema);

const gateCommands = {
  build: 'build', lint: 'lint', typecheck: 'typecheck', tests: 'test',
  integration_tests: 'integration_test', security: 'security',
} as const;

/** Validates data without mutating it, resolving profiles, or executing anything. */
export function validateProject(input: unknown): ValidationResult {
  if (!validateSchema(input)) {
    return {
      valid: false,
      issues: (validateSchema.errors ?? []).map(error => ({
        path: error.instancePath || '/',
        code: `schema.${error.keyword}`,
        // Do not include configuration values or Ajv params in diagnostics.
        message: error.message ?? 'Invalid configuration field.',
      })),
    };
  }

  const issues: ConfigIssue[] = [];
  for (const [gate, command] of Object.entries(gateCommands)) {
    if (input.quality[gate as keyof typeof gateCommands] && !input.commands[command]) {
      issues.push({ path: `/commands/${command}`, code: 'command.required',
        message: 'An enabled quality gate requires an explicit command.' });
    }
  }
  if (Object.keys(input.context).length > 0 && !input.tools.docs.enabled) {
    issues.push({ path: '/tools/docs/enabled', code: 'context.docs_disabled',
      message: 'Context references require the documentation capability to be enabled.' });
  }
  return issues.length ? { valid: false, issues } : { valid: true, config: input };
}

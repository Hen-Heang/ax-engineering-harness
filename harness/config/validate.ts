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

function schemaIssues(input: unknown): ConfigIssue[] {
  if (validateSchema(input)) return [];
  return (validateSchema.errors ?? []).map(error => ({
    path: error.instancePath || '/',
    code: `schema.${error.keyword}`,
    // Do not include configuration values or Ajv params in diagnostics.
    message: error.message ?? 'Invalid configuration field.',
  }));
}

function contextIssues(config: ProjectConfig): ConfigIssue[] {
  if (Object.keys(config.context).length > 0 && !config.tools.docs.enabled) {
    return [{ path: '/tools/docs/enabled', code: 'context.docs_disabled',
      message: 'Context references require the documentation capability to be enabled.' }];
  }
  return [];
}

function commandIssues(config: ProjectConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const [gate, command] of Object.entries(gateCommands)) {
    if (config.quality[gate as keyof typeof gateCommands] && !config.commands[command]) {
      issues.push({ path: `/commands/${command}`, code: 'command.required',
        message: 'An enabled quality gate requires an explicit command.' });
    }
  }
  return issues;
}

/**
 * Profile-independent validation for a declaration as written. Command completeness is
 * deliberately not checked here, because a profile may still supply defaults. Nothing
 * that reaches execution may stop at this check; run validateProject on the resolved
 * configuration to keep the final guarantee.
 */
export function validateDeclaration(input: unknown): ValidationResult {
  const issues = schemaIssues(input);
  if (issues.length) return { valid: false, issues };
  const config = input as ProjectConfig;
  const semantic = contextIssues(config);
  return semantic.length ? { valid: false, issues: semantic } : { valid: true, config };
}

/**
 * Full validation, including the rule that every enabled quality gate has a command.
 * Applied to a resolved configuration this is the authoritative check; a profile can
 * fill a missing command but can never satisfy this check by weakening it.
 * Validates data without mutating it or executing anything.
 */
export function validateProject(input: unknown): ValidationResult {
  const declaration = validateDeclaration(input);
  if (!declaration.valid) return declaration;
  const issues = commandIssues(declaration.config);
  return issues.length ? { valid: false, issues } : declaration;
}

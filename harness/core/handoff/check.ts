import { Ajv } from 'ajv';
import schema from '../../schemas/handoff.schema.json' with { type: 'json' };
import type { HandoffRecord } from '../../config/handoff.generated.js';
import type { ConfigIssue } from '../../config/validate.js';

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<HandoffRecord>(schema);

export type HandoffValidation =
  | { valid: true; record: HandoffRecord }
  | { valid: false; issues: ConfigIssue[] };

/** Validates a structured handoff record. */
export function validateHandoffRecord(input: unknown): HandoffValidation {
  if (validateSchema(input)) return { valid: true, record: input };
  return {
    valid: false,
    issues: (validateSchema.errors ?? []).map(error => ({
      path: error.instancePath || '/',
      code: `schema.${error.keyword}`,
      message: error.message ?? 'Invalid handoff field.',
    })),
  };
}

/** Headings a written handoff must contain to be resumable. */
export const requiredHandoffSections = ['Completed', 'Decisions', 'Validation', 'Next steps'] as const;

/**
 * Checks a handoff written as Markdown, which is how this repository records its own
 * phase handoffs. Returns the problems found; an empty array means the document has
 * the parts another session needs. It checks structure, never whether the claims are
 * true.
 */
export function checkHandoffDocument(markdown: string): string[] {
  const problems: string[] = [];
  const lines = markdown.split(/\r?\n/);

  for (const field of ['Goal', 'Status']) {
    if (!lines.some(line => line.startsWith(`${field}:`))) {
      problems.push(`Missing a "${field}:" statement.`);
    }
  }

  const headings = new Set(
    lines
      .filter(line => line.startsWith('## '))
      .map(line => line.slice(3).trim().toLowerCase()),
  );
  for (const section of requiredHandoffSections) {
    if (!headings.has(section.toLowerCase())) problems.push(`Missing a "## ${section}" section.`);
  }

  return problems;
}

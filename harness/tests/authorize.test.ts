import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authorize, capabilityIds, isAllowed, parseProject, policy,
  type Actor, type AuthorizationOutcome, type DenialReason, type HumanApproval,
  type ProjectConfig,
} from '../index.js';

/**
 * Authorization is a pure function, so these tests are a table rather than a
 * scenario. What matters is not only that the named cases decide correctly, but that
 * nothing decides `allowed` by falling through: every unknown input must be denied.
 */

function project(overrides: {
  github?: boolean;
  database?: boolean;
  codebase?: boolean;
  docs?: boolean;
} = {}): ProjectConfig {
  const template = `schemaVersion: 1
project:
  name: authz-fixture
  mode: single-repo
  profile: harness-tooling
context: {}
commands: {}
tools:
  codebase: { enabled: ${overrides.codebase ?? true} }
  docs: { enabled: ${overrides.docs ?? true} }
  github: { enabled: ${overrides.github ?? true} }
  database: { enabled: ${overrides.database ?? true}, mode: metadata-only }
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
  build: true
  lint: false
  typecheck: false
  tests: true
  integration_tests: false
  security: false
  review: true
  eval: false
  human_approval: true
limits:
  max_retries: 2
  max_duration_seconds: 60
`;
  const parsed = parseProject(template);
  if (!parsed.valid) throw new Error(`invalid authorization fixture: ${JSON.stringify(parsed.issues)}`);
  return parsed.config;
}

const agent = (role: string): Actor => ({ kind: 'agent', role });
const HUMAN: Actor = { kind: 'human-cli' };

const APPROVAL: HumanApproval = {
  capability: 'create_pull_request',
  grantedBy: 'repository owner',
  grantedAt: '2026-09-14T09:00:00.000Z',
};

interface Row {
  actor: Actor;
  capability: string;
  outcome: AuthorizationOutcome;
  reason?: DenialReason;
  approval?: HumanApproval;
  tools?: Parameters<typeof project>[0];
  why: string;
}

const rows: Row[] = [
  // The cases named in the brief.
  {
    actor: agent('backend-engineer'), capability: 'edit_worktree', outcome: 'allowed',
    why: 'a role that holds an ordinary capability, with its tool enabled',
  },
  {
    actor: agent('backend-engineer'), capability: 'direct_main_push',
    outcome: 'denied', reason: 'denied-to-all-agents',
    why: 'a globally denied capability, whatever the role claims',
  },
  {
    actor: agent('backend-engineer'), capability: 'create_pull_request', outcome: 'requires-approval',
    why: 'a high-impact capability the role holds, with no approval supplied',
  },
  {
    actor: agent('backend-engineer'), capability: 'create_pull_request', approval: APPROVAL,
    outcome: 'allowed',
    why: 'the same request with an approval that names it',
  },
  {
    actor: agent('database-reviewer'), capability: 'database_write',
    outcome: 'denied', reason: 'denied-to-all-agents',
    why: 'writing to a database is denied to every role in v1',
  },
  {
    actor: agent('investigator'), capability: 'edit_worktree',
    outcome: 'denied', reason: 'actor-lacks-capability',
    why: 'a read-only role does not edit files',
  },
  {
    actor: agent('backend-engineer'), capability: 'github_read',
    outcome: 'denied', reason: 'tool-disabled', tools: { github: false },
    why: 'a role capability cannot switch on a tool the project disabled',
  },

  // Unknown inputs must never fall through to allowed.
  {
    actor: agent('not-a-role'), capability: 'read_code',
    outcome: 'denied', reason: 'unknown-role',
    why: 'an unrecognised role is denied, not defaulted',
  },
  {
    actor: agent('backend-engineer'), capability: 'invent_a_capability',
    outcome: 'denied', reason: 'unknown-capability',
    why: 'an unrecognised capability is denied, not invented',
  },

  // The other four global denials.
  {
    actor: agent('backend-engineer'), capability: 'force_push',
    outcome: 'denied', reason: 'denied-to-all-agents', why: 'force push is denied in v1',
  },
  {
    actor: agent('backend-engineer'), capability: 'production_deploy',
    outcome: 'denied', reason: 'denied-to-all-agents', why: 'deployment stays a human action',
  },
  {
    actor: agent('backend-engineer'), capability: 'secrets_access',
    outcome: 'denied', reason: 'denied-to-all-agents', why: 'secrets are never read',
  },

  // Tool switches, each independently.
  {
    actor: agent('backend-engineer'), capability: 'read_code',
    outcome: 'denied', reason: 'tool-disabled', tools: { codebase: false },
    why: 'reading code needs the codebase tool',
  },
  {
    actor: agent('investigator'), capability: 'database_metadata',
    outcome: 'denied', reason: 'tool-disabled', tools: { database: false },
    why: 'reading schema needs the database tool',
  },
  {
    actor: agent('investigator'), capability: 'database_metadata', outcome: 'allowed',
    why: 'metadata-only access is permitted when the tool is enabled',
  },

  // The person at the CLI is a distinct actor, not a role.
  {
    actor: HUMAN, capability: 'run_tests', outcome: 'allowed',
    why: 'running declared commands is what the CLI does',
  },
  {
    actor: HUMAN, capability: 'create_pull_request',
    outcome: 'denied', reason: 'actor-lacks-capability',
    why: 'the CLI opens no pull request, so it is authorised for none',
  },
  {
    actor: HUMAN, capability: 'run_tests',
    outcome: 'denied', reason: 'tool-disabled', tools: { codebase: false },
    why: 'the CLI is still bound by the project tool switches',
  },
];

for (const row of rows) {
  const label = row.actor.kind === 'agent' ? row.actor.role : 'human-cli';
  test(`${label} + ${row.capability} is ${row.outcome}: ${row.why}`, () => {
    const decision = authorize({
      actor: row.actor,
      capability: row.capability,
      project: project(row.tools),
      ...(row.approval === undefined ? {} : { approval: row.approval }),
    });
    assert.equal(decision.outcome, row.outcome);
    if (decision.outcome === 'denied') assert.equal(decision.reason, row.reason);
    else assert.equal(row.reason, undefined, 'a non-denial should not expect a reason');
  });
}

test('an approval lifts only requires-approval, never a denial', () => {
  /*
   * If approving could reach a denied capability, approval would become the way
   * around the policy rather than a step within it.
   */
  for (const capability of ['direct_main_push', 'force_push', 'production_deploy', 'database_write', 'secrets_access']) {
    const decision = authorize({
      actor: agent('backend-engineer'),
      capability,
      project: project(),
      approval: { capability, grantedBy: 'repository owner', grantedAt: '2026-09-14T09:00:00.000Z' },
    });
    assert.equal(decision.outcome, 'denied', capability);
  }

  // Nor can it reach a capability the role simply does not hold.
  assert.equal(
    authorize({
      actor: agent('investigator'),
      capability: 'create_pull_request',
      project: project(),
      approval: { capability: 'create_pull_request', grantedBy: 'owner', grantedAt: '2026-09-14T09:00:00.000Z' },
    }).outcome,
    'denied',
  );
});

test('an approval must name this capability, a person, and a real instant', () => {
  const request = {
    actor: agent('backend-engineer'),
    capability: 'create_pull_request',
    project: project(),
  };
  const bad: HumanApproval[] = [
    { capability: 'comment_issue_or_pr', grantedBy: 'owner', grantedAt: '2026-09-14T09:00:00.000Z' },
    { capability: 'create_pull_request', grantedBy: '   ', grantedAt: '2026-09-14T09:00:00.000Z' },
    { capability: 'create_pull_request', grantedBy: 'owner', grantedAt: 'whenever' },
  ];
  for (const approval of bad) {
    assert.equal(
      authorize({ ...request, approval }).outcome,
      'requires-approval',
      JSON.stringify(approval),
    );
  }
  assert.equal(authorize({ ...request, approval: APPROVAL }).outcome, 'allowed');
});

test('no capability is allowed for an unknown role, for any capability in the policy', () => {
  // The deny-by-default rule stated once over the whole vocabulary, not per row.
  for (const capability of capabilityIds) {
    const decision = authorize({ actor: agent('nobody'), capability, project: project() });
    assert.equal(decision.outcome, 'denied', capability);
    assert.equal(isAllowed(decision), false, capability);
  }
});

test('every capability the policy declares decides, and every agent capability is real', () => {
  for (const capability of capabilityIds) {
    const decision = authorize({ actor: agent('backend-engineer'), capability, project: project() });
    assert.ok(
      ['allowed', 'denied', 'requires-approval'].includes(decision.outcome),
      `${capability} produced no decision`,
    );
  }
  // A capability flagged for approval must actually reach requires-approval for a
  // role that holds it, or the flag would be decorative.
  const approvals = policy.capabilities.filter(entry => entry.humanApproval);
  assert.ok(approvals.length > 0, 'the policy should declare at least one approval capability');
  for (const entry of approvals) {
    assert.equal(entry.deniedToAllAgents, false, `${entry.id} cannot both require approval and be denied`);
  }
});

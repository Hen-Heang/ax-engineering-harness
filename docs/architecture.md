# AX Engineering Harness architecture

Status: experimental learning project. Phase 2 configuration foundation.

The Harness is a vendor-neutral engineering layer. Its target lifecycle is:

Requirement → Load instructions → Retrieve context → Investigate → Plan →
Implement → Verify → Review → Evaluate → Human approval → PR / CI → Handoff →
Feedback.

## Boundaries

- `harness/schemas`: portable, versioned contracts. Project schema is implemented.
- `harness/config`: parsing and validation. No execution or provider dependencies.
- `harness/core/context`: reference existence and project-root containment checks.
- Other core areas (workflow, permissions, quality, handoff, observability):
  architectural contracts only at this stage; see the implementation plan.
- Profiles will interpret stack conventions and resolve project commands.
- Codex and Claude adapters will translate shared instructions into vendor files.
- Integrations will expose capabilities behind policy checks, optionally via MCP.
- `apps/web` will render an allowlisted catalog of actual safe Harness definitions.

Only the configuration package currently exists as executable functionality.
Validating a declaration is not resolving a profile, passing quality gates,
authorizing tools, executing an agent, or approving a deployment.

## Public content boundary

The future web build will validate explicitly selected Harness files and produce
a typed public catalog. It must not recursively read legacy configuration,
environment files, credentials, or local execution artifacts. The browser receives
only this safe catalog, with no shell or arbitrary filesystem API.

## Reuse

The TypeScript core has no Spring, React, Next.js, or model-provider dependency.
Stack-specific concepts belong to profile definitions. Agent roles represent
workers; skills represent procedures. Multiple roles do not imply parallel workers.

Configuration and schemas are vendor-neutral even though this first tooling
implementation uses Node.js. Existing Java build systems remain independent.

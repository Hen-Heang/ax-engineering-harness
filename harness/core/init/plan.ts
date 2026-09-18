import { stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { getProfile, profileIds } from '../profiles/registry.js';
import { currentPlatform, resolveRunner, type BuildSystemId } from '../buildsystem/detect.js';
import { detectCommands } from '../capability/detect.js';
import type { ProfileDefinition } from '../../config/profile.generated.js';
import { claudePack } from './claude-pack.js';

/**
 * Proposing an adoption, without performing one.
 *
 * Planning and writing are separate here for the same reason they are separate in
 * the quality pipeline: a person should be able to see exactly what would be created
 * before anything is. This module only reads. It runs nothing, never scans a tree
 * recursively, and reads manifests under a byte ceiling without interpreting them —
 * a `package.json` is parsed to list script *names*, and no build file is evaluated.
 *
 * The declaration it proposes comes from two sources: what the chosen profile can
 * supply, and what the project's own manifest says it can run. Both matter. A
 * declaration built from the profile alone would switch off tests in a repository
 * that plainly has them, leaving the doctor to report an omission this generator had
 * just created. A generated file must describe the project, not only the profile.
 *
 * Everything proposed validates and resolves on the first try, because a template
 * that fails validation would make a schema error somebody's first experience of the
 * harness.
 */

/** Manifest names that identify a build system, checked at the selected root only. */
const MANIFESTS: { file: string; buildSystem: BuildSystemId }[] = [
  { file: 'pom.xml', buildSystem: 'maven' },
  { file: 'build.gradle', buildSystem: 'gradle' },
  { file: 'build.gradle.kts', buildSystem: 'gradle' },
  { file: 'settings.gradle', buildSystem: 'gradle' },
  { file: 'settings.gradle.kts', buildSystem: 'gradle' },
  { file: 'package.json', buildSystem: 'node' },
];

/** Quality gate each command slot satisfies, so a profile's commands decide the gates. */
const SLOT_GATES: Record<string, string> = {
  build: 'build',
  lint: 'lint',
  typecheck: 'typecheck',
  test: 'tests',
  integration_test: 'integration_tests',
  security: 'security',
};

const GATES = [
  'build', 'lint', 'typecheck', 'tests', 'integration_tests', 'security',
] as const;

export interface Detection {
  /** Manifest files found at the root. Names only; contents are never read. */
  manifests: string[];
  buildSystems: BuildSystemId[];
}

export type PlannedFileStatus = 'create' | 'exists';

export interface PlannedFile {
  /** Path relative to the project root, using forward slashes. */
  path: string;
  status: PlannedFileStatus;
  contents: string;
  /** Why this file is proposed, or why it is being left alone. */
  note?: string;
}

export interface InitPlan {
  root: string;
  name: string | null;
  detection: Detection;
  profile: { id: string; source: 'detected' | 'chosen' } | null;
  /** Candidate profiles when detection could not settle on one. */
  candidates: string[];
  files: PlannedFile[];
  /** Reasons nothing can be proposed. A non-empty list means files is empty. */
  blockers: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Reads manifest names at one root. Never recursive, and never opens a manifest. */
export async function detectStack(root: string): Promise<Detection> {
  const manifests: string[] = [];
  const buildSystems = new Set<BuildSystemId>();
  for (const entry of MANIFESTS) {
    if (await exists(join(root, entry.file))) {
      manifests.push(entry.file);
      buildSystems.add(entry.buildSystem);
    }
  }
  return { manifests, buildSystems: [...buildSystems] };
}

/**
 * Profiles that could plausibly serve a detected build system.
 *
 * `harness-tooling` is deliberately excluded: it describes this repository's own
 * workspace, so recommending it for someone else's Node project would be wrong.
 */
function candidatesFor(buildSystem: BuildSystemId): string[] {
  return profileIds.filter(id => {
    if (id === 'harness-tooling') return false;
    const profile = getProfile(id);
    return profile?.buildSystems !== undefined && buildSystem in profile.buildSystems;
  });
}

/** Turns a directory name into a declarable project name, or null if it cannot. */
export function toProjectName(directory: string): string | null {
  const candidate = basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return /^[a-z][a-z0-9-]{0,63}$/.test(candidate) ? candidate : null;
}

/**
 * The platform-correct runner for a build system, so a generated Maven command uses
 * the wrapper this checkout actually has rather than assuming `mvn` is on PATH.
 */
async function runnerFor(
  profile: ProfileDefinition,
  buildSystem: BuildSystemId,
  root: string,
): Promise<string | undefined> {
  const declared = profile.buildSystems?.[buildSystem];
  if (!declared) return undefined;
  return (await resolveRunner(declared, root, currentPlatform())).command;
}

/** The gates a profile supplies a command for, under one build system. */
function supportedGates(profile: ProfileDefinition, buildSystem: BuildSystemId): Set<string> {
  const commands = profile.buildSystems?.[buildSystem]?.commands ?? {};
  const gates = new Set<string>();
  for (const slot of Object.keys(commands)) {
    const gate = SLOT_GATES[slot];
    if (gate) gates.add(gate);
  }
  return gates;
}

function declaration(
  name: string,
  profileId: string,
  gates: Set<string>,
  context: string[],
  commands: Partial<Record<string, string>>,
): string {
  const contextLines = context.length > 0
    ? context.map(key => `  ${key}: .ax/context/${key}.md`).join('\n')
    : '  {}';
  const qualityLines = GATES.map(gate => `  ${gate}: ${gates.has(gate)}`).join('\n');
  const entries = Object.entries(commands).filter(([, value]) => value !== undefined);
  const commandLines = entries.length > 0
    ? entries.map(([slot, value]) => `  ${slot}: ${value}`).join('\n')
    : '  {}';

  return `# Generated by ax init. Review every line before relying on it.
#
# A gate is enabled when either this project or its profile supplies a command for
# it. Commands listed below were read from this project's own manifest and always
# win over the profile's defaults. Enable another gate by declaring its command here
# too; a gate with no command is refused by validation rather than silently skipped.
schemaVersion: 1
project:
  name: ${name}
  mode: single-repo
  profile: ${profileId}
context:
${contextLines}
commands:
${commandLines}
tools:
  codebase:
    enabled: true
  docs:
    enabled: true
  github:
    enabled: false
  database:
    enabled: false
    mode: metadata-only
permissions:
  direct_main_push: false
  force_push: false
  production_deploy: false
  database_write: false
  secrets_access: false
quality:
${qualityLines}
  review: true
  eval: false
  human_approval: true
limits:
  max_retries: 2
  max_duration_seconds: 600
`;
}

function contextTemplate(key: string, name: string): string {
  const prompts: Record<string, string[]> = {
    architecture: [
      'What the system is, and the one or two decisions that shape everything else.',
      'The layers or modules, and what each one owns.',
      'What must not change without discussion, and why.',
    ],
    domain: [
      'The main entities and what they mean in this business, not in the database.',
      'The rules that are easy to get wrong.',
      'Vocabulary the code uses that an outsider would misread.',
    ],
    database: [
      'The engine, and where migrations live.',
      'Tables that matter most, and the relationships between them.',
      'Anything destructive, irreversible, or expensive to get wrong.',
    ],
  };
  const lines = prompts[key] ?? ['Describe this aspect of the project.'];
  return `# ${key[0]?.toUpperCase()}${key.slice(1)} — ${name}

<!--
  Written for whoever, or whatever, works on this next. Replace these prompts with
  real content: an unanswered template is worse than no context, because it reads
  as though the question was considered.
-->

${lines.map(line => `- ${line}`).join('\n')}
`;
}

const AGENTS_TEMPLATE = (name: string, profileId: string) => `# ${name} — repository instructions

<!-- Generated by ax init. Merge into your own AGENTS.md by hand. -->

## Scope

- Describe what this repository is and what must be preserved.

## Architecture

- Record the decisions that constrain how changes are made here.
- Profile: \`${profileId}\`. Stack assumptions belong to the profile, not here.

## Verification

- State which commands must pass before a change is proposed.
- Report failed or unrun checks honestly. An unrun check is not a pass.

## Boundaries

- Name anything that requires human approval, and anything denied outright.
`;

export interface InitOptions {
  root: string;
  /** Explicit profile, which overrides detection. */
  profile?: string;
  /** Explicit project name, for a directory whose name cannot be used. */
  name?: string;
}

/** Produces the plan `ax init` would apply. Reads only; creates nothing. */
export async function planInit(options: InitOptions): Promise<InitPlan> {
  const { root } = options;
  const detection = await detectStack(root);
  const name = options.name ?? toProjectName(root);

  const plan: InitPlan = {
    root,
    name,
    detection,
    profile: null,
    candidates: [],
    files: [],
    blockers: [],
  };

  if (name === null) {
    plan.blockers.push('The directory name cannot be used as a project name. Pass --name to choose one.');
  } else if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) {
    plan.blockers.push(`"${name}" is not a valid project name: lowercase letters, digits, and hyphens only.`);
  }

  let profile: ProfileDefinition | undefined;
  if (options.profile) {
    profile = getProfile(options.profile);
    if (!profile) {
      plan.blockers.push(`Unknown profile "${options.profile}". Known profiles: ${profileIds.join(', ')}.`);
    } else {
      plan.profile = { id: profile.id, source: 'chosen' };
    }
  } else if (detection.buildSystems.length === 0) {
    plan.blockers.push('No build manifest was found at this root, so no profile can be recommended.');
  } else if (detection.buildSystems.length > 1) {
    plan.candidates = [...new Set(detection.buildSystems.flatMap(candidatesFor))];
    plan.blockers.push(
      `Several build systems are present (${detection.buildSystems.join(', ')}). ` +
      'Choose one with --profile rather than having one picked for you.',
    );
  } else {
    const [buildSystem] = detection.buildSystems;
    const candidates = buildSystem ? candidatesFor(buildSystem) : [];
    plan.candidates = candidates;
    if (candidates.length === 1 && candidates[0]) {
      profile = getProfile(candidates[0]);
      if (profile) plan.profile = { id: profile.id, source: 'detected' };
    } else if (candidates.length === 0) {
      plan.blockers.push(`No profile serves ${buildSystem}.`);
    } else {
      plan.blockers.push(
        `More than one profile serves ${buildSystem} (${candidates.join(', ')}). Choose one with --profile.`,
      );
    }
  }

  if (profile?.areas) {
    plan.blockers.push(
      `"${profile.id}" composes several build roots, which cannot be generated from one directory. ` +
      'Declare its areas by hand.',
    );
  }

  if (plan.blockers.length > 0 || !profile || name === null) return plan;

  const [buildSystem] = detection.buildSystems;
  const gates = buildSystem ? supportedGates(profile, buildSystem) : new Set<string>();

  /*
   * What the project itself says it can do. A declaration built from the profile
   * alone under-reports the project — it would switch off tests in a repository with
   * a test script, and the doctor would then have to point out the omission the
   * generator had just created.
   */
  const runner = buildSystem ? await runnerFor(profile, buildSystem, root) : undefined;
  const detected = await detectCommands({
    root,
    buildSystem,
    ...(runner ? { runner } : {}),
  });
  for (const [slot, command] of Object.entries(detected)) {
    if (!command) continue;
    const gate = SLOT_GATES[slot];
    if (gate) gates.add(gate);
  }

  const contextKeys = ['architecture', 'domain', 'database'];
  const fromProject = Object.values(detected).filter(Boolean).length;

  const proposed: { path: string; contents: string; note?: string }[] = [
    {
      path: '.ax/project.yaml',
      contents: declaration(name, profile.id, gates, contextKeys, detected),
      note: `${gates.size} gate(s) enabled; ${fromProject} command(s) read from this project`,
    },
    {
      /*
       * Executing gates writes a run record under .ax/runs/, which is local evidence
       * about one machine at one moment and does not belong in anyone's history. The
       * rule is kept inside .ax rather than appended to the project's own .gitignore,
       * because init must never modify a file the project already owns.
       */
      path: '.ax/.gitignore',
      contents: '# Run records are local evidence, not repository content.\nruns/\n',
      note: 'keeps recorded runs out of the project history',
    },
    ...contextKeys.map(key => ({
      path: `.ax/context/${key}.md`,
      contents: contextTemplate(key, name),
      note: 'template; replace the prompts with real content',
    })),
    {
      path: 'AGENTS.md',
      contents: AGENTS_TEMPLATE(name, profile.id),
      note: 'repository instructions',
    },
    ...claudePack(name, profile.id),
  ];

  for (const file of proposed) {
    const present = await exists(join(root, file.path));
    if (!present) {
      plan.files.push({ path: file.path, status: 'create', contents: file.contents, ...(file.note ? { note: file.note } : {}) });
      continue;
    }
    /*
     * Something is already here. It is left exactly as it is, and for AGENTS.md —
     * the one file most likely to hold work nobody wants merged automatically — a
     * template is offered alongside it instead. Merging is a judgement, not a
     * transformation.
     */
    plan.files.push({
      path: file.path,
      status: 'exists',
      contents: file.contents,
      note: 'already present; left untouched',
    });
    if (file.path === 'AGENTS.md') {
      const templatePath = '.ax/AGENTS.template.md';
      if (!(await exists(join(root, templatePath)))) {
        plan.files.push({
          path: templatePath,
          status: 'create',
          contents: file.contents,
          note: 'AGENTS.md exists, so this is written beside it for you to merge by hand',
        });
      }
    }
  }

  return plan;
}

/**
 * Every page the console serves.
 *
 * The list is written out rather than derived, so a page added without being checked
 * here is a visible omission in a diff rather than a silent gap.
 */
export const routes = [
  '/',
  '/architecture',
  '/workflow',
  '/profiles',
  '/agents',
  '/skills',
  '/tools',
  '/policies',
  '/quality',
  '/evals',
  '/runs',
  '/projects',
  '/config',
  '/config/agent/planner',
  '/config/profile/nextjs-react',
  '/docs',
] as const;

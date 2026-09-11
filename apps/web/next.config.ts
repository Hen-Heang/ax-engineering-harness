import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * Dependencies are hoisted to the npm workspace root, so Turbopack has to resolve
 * from there. Left to infer, a build whose root is `apps/web` cannot even find Next
 * itself, which is what happens when a platform treats this directory as the project
 * root. Stating the workspace root explicitly is the documented fix.
 */
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The console renders the allowlisted catalog that is compiled into the bundle.
 * It performs no filesystem access at request time and exposes no server action
 * that could read arbitrary repository files.
 */
const config: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: workspaceRoot },
};

export default config;

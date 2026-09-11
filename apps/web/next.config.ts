import type { NextConfig } from 'next';

/**
 * The console renders the allowlisted catalog that is compiled into the bundle.
 * It performs no filesystem access at request time and exposes no server action
 * that could read arbitrary repository files.
 */
const config: NextConfig = {
  reactStrictMode: true,
};

export default config;

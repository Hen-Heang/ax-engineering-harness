import { defineConfig, devices } from '@playwright/test';

const port = 3210;
const baseURL = `http://localhost:${port}`;
const chrome = devices['Desktop Chrome'];

const responsive = /responsive\.spec\.ts/;
const accessibility = /accessibility\.spec\.ts/;
const wide = /navigation-wide\.spec\.ts/;
const narrow = /navigation-narrow\.spec\.ts/;

/**
 * Browser verification for the console.
 *
 * Earlier phases checked pages by sampling one width by hand. This runs every page at
 * four widths, so a regression at a size nobody looked at is caught rather than
 * discovered later.
 *
 * Which specs run at which width is decided here rather than by skipping at runtime,
 * so a spec never reports as skipped when it simply does not apply to that layout.
 *
 * It serves a production build, because that is what a reader would see, so the build
 * must exist first; `npm run check` builds before calling this. Only Chromium is
 * installed, so other engines remain unverified and the documentation says so.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'off' },
  projects: [
    {
      name: 'desktop',
      testMatch: [responsive, accessibility, wide],
      use: { ...chrome, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      testMatch: [responsive],
      use: { ...chrome, viewport: { width: 768, height: 1024 } },
    },
    {
      // 428px is an iPhone 12 Pro Max in CSS pixels.
      name: 'mobile',
      testMatch: [responsive, accessibility, narrow],
      use: { ...chrome, viewport: { width: 428, height: 926 } },
    },
    {
      name: 'narrow',
      testMatch: [responsive, narrow],
      use: { ...chrome, viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    // Started directly rather than through npm: the extra wrapper process is not
    // always cleaned up on Windows, which leaves a server holding Next's native
    // binary and makes a later "npm ci" fail with EPERM.
    command: `npx next start --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

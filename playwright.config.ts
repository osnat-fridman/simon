import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Set to the deployed site (e.g. https://osnat-fridman.github.io/simon/) to test it instead.
const LIVE_URL = process.env.SIMON_LIVE_URL;
// CI builds dist/ once and tests that same build, which is then deployed.
const SKIP_BUILD = process.env.SIMON_SKIP_BUILD === '1';

const localProjects = [
  { name: 'chromium-mobile', testIgnore: ['pwa/**', 'live/**'], use: { ...devices['Pixel 7'] } },
  { name: 'webkit-mobile', testIgnore: ['pwa/**', 'live/**'], use: { ...devices['iPhone 13'] } },
  // Service worker and offline checks run in Chromium only, with real service workers.
  {
    name: 'chromium-pwa',
    testMatch: 'pwa/**/*.spec.ts',
    use: { ...devices['Pixel 7'], serviceWorkers: 'allow' as const },
  },
];

const liveProjects = [
  {
    name: 'live',
    testMatch: 'live/**/*.spec.ts',
    use: { ...devices['Pixel 7'], serviceWorkers: 'allow' as const },
  },
];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: LIVE_URL ?? `http://localhost:${PORT}/simon/`,
    trace: 'retain-on-failure',
  },
  projects: LIVE_URL ? liveProjects : localProjects,
  // Local tests run against the production build, served locally.
  webServer: LIVE_URL
    ? undefined
    : {
        command: `${SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/simon/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

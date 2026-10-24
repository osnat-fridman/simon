import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/simon/`,
  },
  projects: [
    { name: 'chromium-mobile', testIgnore: 'pwa/**', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', testIgnore: 'pwa/**', use: { ...devices['iPhone 13'] } },
    // Service worker and offline checks run in Chromium only, with real service workers.
    {
      name: 'chromium-pwa',
      testMatch: 'pwa/**/*.spec.ts',
      use: { ...devices['Pixel 7'], serviceWorkers: 'allow' },
    },
  ],
  // Tests run against the production build, served locally.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/simon/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

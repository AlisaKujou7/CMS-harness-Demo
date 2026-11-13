import { defineConfig, devices } from '@playwright/test';

// A browser against the running Compose stack, which `infra/scripts/local-up.sh` starts. Headers and
// cross-origin uploads are nginx's and storage's doing, and only a browser enforces them.
export default defineConfig({
  testDir: '.',
  testMatch: '*.compose.spec.ts',
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: '../../test-results/compose',
  use: {
    baseURL: process.env['COMPOSE_BASE_URL'] ?? 'https://localhost:8443',
    // The local stack's certificate is self-signed.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

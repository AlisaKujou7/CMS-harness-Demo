import { defineConfig, devices } from '@playwright/test';
import { WEB_URL } from './test/e2e/support/stack-config';

// 06-TEST-STRATEGY 9.2. No retries, because a flow that needs one is a flaky flow (M-TEST-04).
export default defineConfig({
  testDir: './test/e2e/flows',
  testMatch: '*.e2e.spec.ts',
  globalSetup: './test/e2e/support/global-setup.ts',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

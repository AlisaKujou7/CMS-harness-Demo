import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.spec.ts', 'test/integration/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

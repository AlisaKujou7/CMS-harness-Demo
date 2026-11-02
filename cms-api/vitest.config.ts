import { defineConfig } from 'vitest/config';

const FULL = { lines: 100, functions: 100, branches: 100, statements: 100 };

// `unit` needs no external services: it covers the domain, use cases with fakes, and HTTP adapters
// in process. `docker` runs driven adapters against real Postgres and Redis containers.
// Thresholds follow 05-METRICS 3.2 (per layer) and 3.3 (critical paths).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        test: {
          name: 'docker',
          include: ['test/integration/**/*.spec.ts'],
          globalSetup: ['test/integration/global-setup.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.types.ts',
        'src/**/*.generated.ts',
        'src/generated/**',
        'src/**/index.ts',
        'src/composition/**',
        'src/main.ts',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        branches: 98,
        statements: 98,
        'src/shared/kernel/**': FULL,
        'src/modules/*/domain/**': FULL,
        'src/modules/*/application/**': {
          lines: 100,
          functions: 100,
          branches: 98,
          statements: 100,
        },
        'src/modules/*/adapters/**': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/modules/auth/**': FULL,
        'src/modules/public-api/**': FULL,
      },
    },
  },
});

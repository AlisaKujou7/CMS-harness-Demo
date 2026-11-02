import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Thresholds follow 05-METRICS 3.2. The app shell is verified by E2E only.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.stories.tsx',
        'src/**/*.types.ts',
        'src/**/*.generated.ts',
        'src/**/index.ts',
        'src/main.tsx',
        'src/app/**',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        branches: 98,
        statements: 98,
        'src/features/*/streams/**': { lines: 100, functions: 100, branches: 98, statements: 100 },
        'src/features/*/hooks/**': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/features/*/components/**': { lines: 95, functions: 95, branches: 90, statements: 95 },
        'src/design-system/**': { lines: 98, functions: 98, branches: 95, statements: 98 },
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

// Mutation testing runs the in-process suite only. Driven adapters need containers, so they are
// left out of `mutate` in stryker.conf.json and covered by the docker project instead.
export default defineConfig({
  test: { include: ['src/**/*.spec.ts'] },
});

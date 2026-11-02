// Reactive rules from 04-ARCH 5.8 and 05-METRICS 5.1. Paths are relative to cms-web/.
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'M-DEP-01',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'design-system-is-a-leaf',
      comment: 'design-system imports only itself and npm packages',
      severity: 'error',
      from: { path: '^src/design-system/' },
      to: { path: '^src/', pathNot: '^src/design-system/' },
    },
    {
      name: 'shared-not-to-features-or-app',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app)/' },
    },
    {
      name: 'features-not-to-app',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-sibling-features',
      comment: 'M-RX-06',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'not-to-spec',
      comment: 'Production code never imports a test',
      severity: 'error',
      from: { pathNot: '(\\.spec\\.tsx?$|^test/)' },
      to: { path: '(\\.spec\\.tsx?$|^test/)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
};

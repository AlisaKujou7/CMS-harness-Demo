// Hexagonal rules from 04-ARCH 4.8 and 05-METRICS 4.1-4.2. Paths are relative to cms-api/.
const MODULE = '^src/modules/([^/]+)';

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
      name: 'domain-knows-nothing',
      comment: 'M-HEX-01: domain may import its own domain and the shared kernel only',
      severity: 'error',
      from: { path: `${MODULE}/domain/`, pathNot: '\\.spec\\.ts$' },
      to: { pathNot: ['^src/modules/$1/domain/', '^src/shared/kernel/'] },
    },
    {
      name: 'kernel-knows-nothing',
      severity: 'error',
      from: { path: '^src/shared/kernel/', pathNot: '\\.spec\\.ts$' },
      to: { pathNot: '^src/shared/kernel/' },
    },
    {
      name: 'application-not-to-adapters',
      comment: 'M-HEX-02',
      severity: 'error',
      from: { path: `${MODULE}/application/` },
      to: { path: ['^src/modules/[^/]+/adapters/', '^src/shared/adapters/'] },
    },
    {
      name: 'application-no-third-party',
      comment: 'M-HEX-05: third-party types stay behind a port',
      severity: 'error',
      from: { path: `${MODULE}/application/`, pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'npm-no-pkg'] },
    },
    {
      name: 'adapters-in-not-to-adapters-out',
      comment: 'M-HEX-03',
      severity: 'error',
      from: { path: `${MODULE}/adapters/in/` },
      to: { path: '^src/modules/[^/]+/adapters/out/' },
    },
    {
      name: 'adapters-out-not-to-adapters-in',
      comment: 'M-HEX-03',
      severity: 'error',
      from: { path: `${MODULE}/adapters/out/` },
      to: { path: '^src/modules/[^/]+/adapters/in/' },
    },
    {
      name: 'adapters-in-not-to-domain',
      comment: '04-ARCH 4.8: driving adapters go through use cases',
      severity: 'error',
      from: { path: `${MODULE}/adapters/in/` },
      to: { path: '^src/modules/[^/]+/domain/' },
    },
    {
      name: 'adapters-out-only-outbound-ports',
      comment: '04-ARCH 4.8: driven adapters implement outbound ports',
      severity: 'error',
      from: { path: `${MODULE}/adapters/out/` },
      to: {
        path: '^src/modules/[^/]+/application/',
        pathNot: '^src/modules/[^/]+/application/ports/out/',
      },
    },
    {
      name: 'no-cross-module-internals',
      comment: 'M-HEX-04: another module is reachable through its inbound ports only',
      severity: 'error',
      from: { path: MODULE },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/application/ports/in/'],
      },
    },
    {
      name: 'not-to-spec',
      comment: 'Production code never imports a test',
      severity: 'error',
      from: { pathNot: '(\\.spec\\.ts$|^test/)' },
      to: { path: '(\\.spec\\.ts$|^test/)' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '^src/generated/'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.js', '.json'] },
  },
};

// Proves the gates catch real violations: plants each one, expects its gate to fail for the
// expected reason, then removes it. A gate that cannot fail is not a gate.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const API = 'cms-api/src/modules';
const WEB = 'cms-web/src/features';
const API_DEPS = 'pnpm --filter cms-api depcruise';
const WEB_DEPS = 'pnpm --filter cms-web depcruise';
const LINT = 'pnpm lint';

const SCENARIOS = [
  {
    name: 'domain imports a framework or Node API',
    files: { [`${API}/zzq/domain/bad.ts`]: "import 'node:fs';\nexport const bad = 1;\n" },
    command: API_DEPS,
    expect: /domain-knows-nothing/,
  },
  {
    name: 'application imports an adapter',
    files: {
      [`${API}/zzq/adapters/out/a.ts`]: 'export const a = 1;\n',
      [`${API}/zzq/application/b.ts`]: "export { a } from '../adapters/out/a.js';\n",
    },
    command: API_DEPS,
    expect: /application-not-to-adapters/,
  },
  {
    name: 'application imports a third-party package',
    files: { [`${API}/zzq/application/c.ts`]: "export { default } from 'fast-check';\n" },
    command: API_DEPS,
    expect: /application-no-third-party/,
  },
  {
    name: 'inbound adapter imports the domain',
    files: {
      [`${API}/zzq/domain/d.ts`]: 'export const d = 1;\n',
      [`${API}/zzq/adapters/in/e.ts`]: "export { d } from '../../domain/d.js';\n",
    },
    command: API_DEPS,
    expect: /adapters-in-not-to-domain/,
  },
  {
    name: 'inbound adapter imports an outbound adapter',
    files: {
      [`${API}/zzq/adapters/out/f.ts`]: 'export const f = 1;\n',
      [`${API}/zzq/adapters/in/g.ts`]: "export { f } from '../out/f.js';\n",
    },
    command: API_DEPS,
    expect: /adapters-in-not-to-adapters-out/,
  },
  {
    name: 'module imports internals of another module',
    files: {
      [`${API}/zzq/application/use-cases/h.ts`]: 'export const h = 1;\n',
      [`${API}/zzr/application/i.ts`]:
        "export { h } from '../../zzq/application/use-cases/h.js';\n",
    },
    command: API_DEPS,
    expect: /no-cross-module-internals/,
  },
  {
    name: 'circular dependency',
    files: {
      [`${API}/zzq/domain/j.ts`]: "import { k } from './k.js';\nexport const j = () => k;\n",
      [`${API}/zzq/domain/k.ts`]: "import { j } from './j.js';\nexport const k = () => j;\n",
    },
    command: API_DEPS,
    expect: /no-circular/,
  },
  {
    name: 'feature imports a sibling feature',
    files: {
      [`${WEB}/zzq/a.ts`]: 'export const a = 1;\n',
      [`${WEB}/zzr/b.ts`]: "export { a } from '../zzq/a';\n",
    },
    command: WEB_DEPS,
    expect: /no-sibling-features/,
  },
  {
    name: 'design system imports shared code',
    files: {
      'cms-web/src/shared/zzq.ts': 'export const a = 1;\n',
      'cms-web/src/design-system/zzq.ts': "export { a } from '../shared/zzq';\n",
    },
    command: WEB_DEPS,
    expect: /design-system-is-a-leaf/,
  },
  {
    name: 'explicit any type',
    files: { 'cms-api/src/shared/zzq.ts': 'export const a = (b: any): unknown => b;\n' },
    command: LINT,
    expect: /no-explicit-any/,
  },
  {
    name: 'component calls fetch directly',
    files: {
      [`${WEB}/zzq/components/Bad.tsx`]:
        "export const Bad = () => <button onClick={() => void fetch('/x')} />;\n",
    },
    command: LINT,
    expect: /M-RX-01/,
  },
  {
    name: 'presentational component reads a query',
    files: {
      [`${WEB}/zzq/components/Bad.tsx`]:
        "import { useQuery } from '@tanstack/react-query';\nexport const Bad = useQuery;\n",
    },
    command: LINT,
    expect: /M-RX-04/,
  },
  {
    name: 'component has too many useState calls',
    files: {
      [`${WEB}/zzq/pages/Bad.tsx`]: [
        "import { useState } from 'react';",
        'export function Bad() {',
        ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => `  const ${name} = useState(0);`),
        '  return <div>{[a, b, c, d, e, f, g].length}</div>;',
        '}',
        '',
      ].join('\n'),
    },
    command: LINT,
    expect: /M-RX-08/,
  },
  {
    name: 'UI text written inline',
    files: { [`${WEB}/zzq/pages/Bad.tsx`]: 'export const Bad = () => <p>Inline words</p>;\n' },
    command: LINT,
    expect: /NFR-I18N-03/,
  },
  {
    name: 'component subscribes by itself',
    files: {
      [`${WEB}/zzq/pages/Bad.tsx`]:
        "import { of } from 'rxjs';\nof(1).subscribe();\nexport const Bad = () => <br />;\n",
    },
    command: LINT,
    expect: /M-STATE-04/,
  },
  {
    name: 'query key without its feature',
    files: {
      [`${WEB}/zzq/pages/bad.ts`]: "export const bad = { queryKey: ['stranger', 1] };\n",
    },
    command: LINT,
    expect: /M-STATE-02/,
  },
  {
    name: 'skipped test',
    files: {
      'cms-api/src/shared/zzq.spec.ts':
        "import { expect, it } from 'vitest';\nit.skip('x', () => {\n  expect(1).toBe(1);\n});\n",
    },
    command: LINT,
    expect: /no-disabled-tests/,
  },
  {
    name: 'function above the complexity limit',
    files: {
      'cms-api/src/shared/zzq.ts': `export function f(a: number): number {\n${Array.from(
        { length: 11 },
        (_, i) => `  if (a === ${String(i)}) return ${String(i)};`,
      ).join('\n')}\n  return a;\n}\n`,
    },
    command: LINT,
    expect: /complexity/,
  },
  {
    name: 'browser code uses a Node global',
    files: { 'cms-web/src/shared/zzq.ts': 'export const home = process.env.HOME;\n' },
    command: 'pnpm --filter cms-web typecheck',
    expect: /process/,
  },
  {
    name: 'unchecked indexed access',
    files: {
      'cms-api/src/shared/zzq.ts':
        'export const f = (a: number[]): number => {\n  const b: number = a[0];\n  return b;\n};\n',
    },
    command: 'pnpm --filter cms-api typecheck',
    expect: /TS2322/,
  },
  {
    name: 'kernel code without tests drops coverage below 100%',
    files: { 'cms-api/src/shared/kernel/zzq.ts': 'export const f = (a: number) => a + 1;\n' },
    command: 'pnpm --filter cms-api test:cov',
    expect: /threshold/i,
  },
  {
    name: 'duplicated code',
    files: Object.fromEntries(
      ['a', 'b'].map((suffix) => [
        `cms-api/src/shared/zzq-${suffix}.ts`,
        `export function dup${suffix}(a: number, b: number): number {\n${Array.from(
          // Below maxLines in .jscpd.json, or jscpd skips the file and nothing is proven.
          { length: 900 },
          (_, i) => `  a = a * ${String(i)} + b - ${String(i * 3)};`,
        ).join('\n')}\n  return a;\n}\n`,
      ]),
    ),
    command: 'pnpm dup',
    expect: /too many duplicates/i,
  },
  {
    name: 'unlinked TODO',
    files: { 'cms-api/src/shared/zzq.ts': '// TODO: later\nexport const a = 1;\n' },
    command: 'node tools/gates/check.mjs todos',
    expect: /M-DEBT-02/,
  },
  {
    name: 'test that asserts nothing lets mutants survive',
    files: {
      [`${API}/auth/domain/zzq.ts`]: `export const f = (a: number, b: number) => [${Array.from(
        { length: 12 },
        (_, i) => `a > b + ${String(i)} ? a + b : a - b`,
      ).join(', ')}];\n`,
      [`${API}/auth/domain/zzq.spec.ts`]:
        "import { expect, it } from 'vitest';\nimport { f } from './zzq.js';\nit('runs', () => {\n  f(2, 1);\n  f(1, 2);\n  expect(true).toBe(true);\n});\n",
    },
    command: 'pnpm --filter cms-api test:mutation && node tools/gates/check.mjs mutation',
    expect: /M-TEST-07/,
  },
  {
    name: 'domain entity with a public mutable field',
    files: { [`${API}/zzq/domain/bad.ts`]: 'export class Bad {\n  status = 1;\n}\n' },
    command: LINT,
    expect: /M-HEX-08/,
  },
  {
    name: 'outbound port without a fake',
    files: {
      [`${API}/zzq/application/ports/out/bad.port.ts`]:
        'export interface ZzqGateway {\n  call(): Promise<void>;\n}\n',
    },
    command: 'node tools/gates/check.mjs architecture',
    expect: /M-HEX-06 port ZzqGateway/,
  },
  {
    name: 'use case without a spec',
    files: { [`${API}/zzq/application/bad.use-case.ts`]: 'export const a = 1;\n' },
    command: 'node tools/gates/check.mjs architecture',
    expect: /M-HEX-07 use case bad\.use-case/,
  },
];

const PLANTED_ROOTS = [
  `${API}/zzq`,
  `${API}/zzr`,
  `${WEB}/zzq`,
  `${WEB}/zzr`,
  'cms-web/src/shared/zzq.ts',
  'cms-web/src/design-system/zzq.ts',
];

function cleanUp(files) {
  for (const path of [...PLANTED_ROOTS, ...Object.keys(files)]) {
    rmSync(join(ROOT, path), { recursive: true, force: true });
  }
}

function runScenario({ name, files, command, expect }) {
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(ROOT, path)), { recursive: true });
      writeFileSync(join(ROOT, path), content);
    }
    const { status, stdout, stderr } = spawnSync(command, {
      cwd: ROOT,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const caught = status !== 0 && expect.test(stdout + stderr);
    console.log(`${caught ? 'CAUGHT' : 'MISSED'}  ${name}`);
    // Why it was missed is usually in the tail, and a rerun may not show it again.
    if (!caught) console.log(`exit ${String(status)}\n${(stdout + stderr).slice(-3000)}`);
    if (!caught) console.log(`  exit ${String(status)}\n${(stdout + stderr).slice(-1500)}`);
    return caught;
  } finally {
    cleanUp(files);
  }
}

const filter = process.argv[2];
const selected = filter ? SCENARIOS.filter(({ name }) => name.includes(filter)) : SCENARIOS;
const missed = selected.filter((scenario) => !runScenario(scenario));
console.log(`\n${String(selected.length - missed.length)}/${String(selected.length)} caught`);
process.exit(missed.length > 0 ? 1 : 0);

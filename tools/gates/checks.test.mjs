import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkBundleBudgets,
  evaluateTestRatio,
  findDisallowedLicenses,
  findMissingStrictFlags,
  findPortsWithoutFakes,
  findUnlinkedTodos,
  findUntestedUseCases,
  findWeakMutationScores,
  isLicenseAllowed,
} from './checks.mjs';

const KB = 1024;

describe('findPortsWithoutFakes (M-HEX-06)', () => {
  const ports = `
    export interface Clock { now(): Date; }
    export interface EmailMessage { readonly to: string; }
    export interface Cache { get(key: string): Promise<string>; }
  `;

  it('lists ports that no fake implements, ignoring plain data types', () => {
    const fakes = 'export class FakeClock implements Clock {}';

    assert.deepEqual(findPortsWithoutFakes([ports], [fakes]), ['Cache']);
  });

  it('accepts ports whose fakes exist in any file', () => {
    const fakes = ['class A implements Clock {}', 'class B implements Cache {}'];

    assert.deepEqual(findPortsWithoutFakes([ports], fakes), []);
  });

  it('does not confuse a port with one whose name merely contains it', () => {
    assert.deepEqual(findPortsWithoutFakes([ports], ['class A implements ClockPort {}']), [
      'Clock',
      'Cache',
    ]);
  });
});

describe('findUntestedUseCases (M-HEX-07)', () => {
  it('lists use cases that no spec imports', () => {
    const useCases = ['login.use-case', 'logout.use-case'];
    const specs = ["import { Login } from './login.use-case.js';"];

    assert.deepEqual(findUntestedUseCases(useCases, specs), ['logout.use-case']);
  });
});

describe('findWeakMutationScores (M-TEST-07)', () => {
  const report = (entries) => ({
    files: Object.fromEntries(
      Object.entries(entries).map(([path, statuses]) => [
        path,
        { mutants: statuses.map((status) => ({ status })) },
      ]),
    ),
  });
  const statuses = (killed, survived) => [
    ...Array(killed).fill('Killed'),
    ...Array(survived).fill('Survived'),
  ];

  it('accepts critical code at exactly 90%', () => {
    const result = findWeakMutationScores(
      report({ 'src/modules/auth/domain/a.ts': statuses(9, 1) }),
    );

    assert.deepEqual(result, []);
  });

  it('flags a critical group below 90%', () => {
    const result = findWeakMutationScores(
      report({ 'src/modules/auth/application/a.ts': statuses(8, 2) }),
    );

    assert.equal(result.length, 1);
    assert.match(result[0], /M-TEST-07.*src\/modules\/auth\/application.*80\.0/);
  });

  it('holds every domain and the kernel to 90%', () => {
    const result = findWeakMutationScores(
      report({
        'src/modules/content/domain/a.ts': statuses(1, 1),
        'src/shared/kernel/a.ts': statuses(1, 1),
      }),
    );

    assert.equal(result.length, 2);
  });

  it('counts timeouts as killed, and uncovered mutants against the score', () => {
    const ok = findWeakMutationScores(
      report({ 'src/shared/kernel/a.ts': [...statuses(9, 0), 'Timeout'] }),
    );
    const weak = findWeakMutationScores(
      report({ 'src/shared/kernel/a.ts': [...statuses(1, 0), 'NoCoverage'] }),
    );

    assert.deepEqual(ok, []);
    assert.equal(weak.length, 1);
  });

  it('ignores mutants Stryker could not run', () => {
    const result = findWeakMutationScores(
      report({ 'src/shared/kernel/a.ts': [...statuses(1, 0), 'Ignored', 'CompileError'] }),
    );

    assert.deepEqual(result, []);
  });

  it('does not hold other code to the critical bar', () => {
    const result = findWeakMutationScores(
      report({ 'src/modules/content/adapters/in/a.ts': statuses(1, 9) }),
    );

    assert.deepEqual(result, []);
  });
});

describe('findMissingStrictFlags', () => {
  const allFlags = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
  };

  it('accepts a config with every flag from M-TS-01..04', () => {
    assert.deepEqual(findMissingStrictFlags({ compilerOptions: allFlags }), []);
  });

  it('reports a flag that is turned off', () => {
    const config = { compilerOptions: { ...allFlags, noImplicitOverride: false } };

    assert.deepEqual(findMissingStrictFlags(config), ['noImplicitOverride']);
  });

  it('reports every flag when compilerOptions is absent', () => {
    assert.equal(findMissingStrictFlags({}).length, 4);
  });
});

describe('checkBundleBudgets', () => {
  it('accepts bundles exactly at their budgets', () => {
    const violations = checkBundleBudgets([
      { name: 'index.js', kind: 'initial', gzipBytes: 250 * KB },
      { name: 'route.js', kind: 'route', gzipBytes: 100 * KB },
      { name: 'index.css', kind: 'css', gzipBytes: 50 * KB },
    ]);

    assert.deepEqual(violations, []);
  });

  it('sums all initial chunks against the 250 KB budget', () => {
    const violations = checkBundleBudgets([
      { name: 'a.js', kind: 'initial', gzipBytes: 200 * KB },
      { name: 'b.js', kind: 'initial', gzipBytes: 51 * KB },
    ]);

    assert.equal(violations.length, 1);
    assert.match(violations[0], /M-BUN-01/);
  });

  it('flags a single route chunk over 100 KB', () => {
    const violations = checkBundleBudgets([
      { name: 'big.js', kind: 'route', gzipBytes: 100 * KB + 1 },
    ]);

    assert.match(violations[0], /M-BUN-02.*big\.js/);
  });

  it('sums CSS against the 50 KB budget', () => {
    const violations = checkBundleBudgets([{ name: 'a.css', kind: 'css', gzipBytes: 50 * KB + 1 }]);

    assert.match(violations[0], /M-BUN-03/);
  });
});

describe('findUnlinkedTodos', () => {
  it('accepts a TODO that links an issue', () => {
    assert.deepEqual(findUnlinkedTodos('// TODO(CMS-142): remove the flag'), []);
  });

  it('flags TODO and FIXME without an issue and reports the line number', () => {
    const text = 'const a = 1;\n// TODO: later\n// FIXME broken';

    assert.deepEqual(findUnlinkedTodos(text), [2, 3]);
  });

  it('ignores words that merely contain the letters', () => {
    assert.deepEqual(findUnlinkedTodos('const todos = [];'), []);
  });
});

describe('isLicenseAllowed', () => {
  it('accepts every license on the M-LIC-03 list', () => {
    for (const license of ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0']) {
      assert.equal(isLicenseAllowed(license), true, license);
    }
  });

  it('accepts the attribution-free licenses added by ADR-0014', () => {
    assert.equal(isLicenseAllowed('MIT-0'), true);
    assert.equal(isLicenseAllowed('0BSD'), true);
  });

  it('rejects GPL family and unknown licenses', () => {
    for (const license of ['GPL-3.0', 'AGPL-3.0', 'UNKNOWN', '']) {
      assert.equal(isLicenseAllowed(license), false, license);
    }
  });

  it('accepts an OR expression when one side is allowed', () => {
    assert.equal(isLicenseAllowed('(GPL-3.0 OR MIT)'), true);
  });

  it('rejects an AND expression when one side is not allowed', () => {
    assert.equal(isLicenseAllowed('MIT AND GPL-3.0'), false);
  });
});

describe('findDisallowedLicenses', () => {
  it('lists the packages under a disallowed license from pnpm output', () => {
    const report = { MIT: [{ name: 'react' }], 'GPL-3.0': [{ name: 'bad-pkg' }] };

    assert.deepEqual(findDisallowedLicenses(report), ['bad-pkg (GPL-3.0)']);
  });

  it('excepts only the libvips binaries, under only their own license (ADR-0015)', () => {
    const report = {
      'LGPL-3.0-or-later': [{ name: '@img/sharp-libvips-linux-x64' }, { name: 'other-lgpl' }],
      'Apache-2.0 AND LGPL-3.0-or-later': [{ name: '@img/sharp-win32-x64' }],
      'GPL-3.0': [{ name: '@img/sharp-linux-x64' }],
    };

    assert.deepEqual(findDisallowedLicenses(report), [
      'other-lgpl (LGPL-3.0-or-later)',
      '@img/sharp-linux-x64 (GPL-3.0)',
    ]);
  });
});

describe('findDisallowedLicenses for fonts (ADR-0016)', () => {
  it('excepts only the two fonts 03-DESIGN names', () => {
    const report = {
      'OFL-1.1': [
        { name: '@fontsource-variable/roboto-flex' },
        { name: '@fontsource/roboto-mono' },
        { name: '@fontsource/other' },
      ],
    };

    assert.deepEqual(findDisallowedLicenses(report), ['@fontsource/other (OFL-1.1)']);
  });
});

describe('evaluateTestRatio', () => {
  const numstat = (...rows) => rows.map(([add, del, path]) => `${add}\t${del}\t${path}`).join('\n');

  it('passes when tests add at least as many lines as production code', () => {
    const result = evaluateTestRatio(
      numstat([10, 2, 'cms-api/src/a.ts'], [10, 0, 'cms-api/src/a.spec.ts']),
    );

    assert.deepEqual(result, { productionLoc: 10, testLoc: 10, ratio: 1, ok: true, reason: '' });
  });

  it('fails M-TDD-06 when production code changed with no test file', () => {
    const result = evaluateTestRatio(numstat([5, 0, 'cms-web/src/a.tsx']));

    assert.equal(result.ok, false);
    assert.match(result.reason, /M-TDD-06/);
  });

  it('fails M-TDD-01 when tests are smaller than production code', () => {
    const result = evaluateTestRatio(
      numstat([20, 0, 'cms-api/src/a.ts'], [10, 0, 'cms-api/src/a.spec.ts']),
    );

    assert.equal(result.ok, false);
    assert.match(result.reason, /M-TDD-01/);
  });

  it('passes a change with no production code such as docs or config', () => {
    const result = evaluateTestRatio(numstat([40, 3, 'docs/adr/0001.md'], [1, 1, 'package.json']));

    assert.equal(result.ok, true);
  });

  it('counts files under test/ as tests and ignores generated files', () => {
    const result = evaluateTestRatio(
      numstat(
        [5, 0, 'cms-api/src/a.ts'],
        [5, 0, 'cms-api/test/fakes/a.ts'],
        [900, 0, 'cms-web/src/api.generated.ts'],
      ),
    );

    assert.deepEqual(result, { productionLoc: 5, testLoc: 5, ratio: 1, ok: true, reason: '' });
  });

  it('treats binary files as zero lines', () => {
    const result = evaluateTestRatio(numstat(['-', '-', 'cms-web/src/logo.ts']));

    assert.equal(result.productionLoc, 0);
  });
});

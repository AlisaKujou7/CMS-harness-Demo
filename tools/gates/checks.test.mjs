import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkBundleBudgets,
  evaluateTestRatio,
  findDisallowedLicenses,
  findMissingStrictFlags,
  findUnlinkedTodos,
  isLicenseAllowed,
} from './checks.mjs';

const KB = 1024;

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

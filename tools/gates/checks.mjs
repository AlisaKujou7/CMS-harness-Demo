// Pure gate rules from 05-METRICS. File and process access lives in check.mjs.

const KB = 1024;
const INITIAL_BUDGET = 250 * KB;
const ROUTE_BUDGET = 100 * KB;
const CSS_BUDGET = 50 * KB;

const REQUIRED_STRICT_FLAGS = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
];

const ALLOWED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'MIT-0',
  '0BSD',
]);

export function findPortsWithoutFakes(portSources, fakeSources) {
  const fakes = fakeSources.join('\n');
  const ports = portSources.flatMap((source) =>
    [...source.matchAll(/export interface (\w+)[^{]*\{([^}]*)\}/g)]
      .filter(([, , body]) => body.includes('('))
      .map(([, name]) => name),
  );
  return ports.filter((port) => !new RegExp(`implements\\s+${port}\\b`).test(fakes));
}

export function findUntestedUseCases(useCaseNames, specSources) {
  const specs = specSources.join('\n');
  return useCaseNames.filter((name) => !specs.includes(`/${name}.js`));
}

// 05-METRICS 3.2 and 3.3. Each entry is scored as one group per module or path.
const MUTATION_BARS = [
  { pattern: /^src\/modules\/[^/]+\/domain\//, depth: 4, minimum: 90 },
  { pattern: /^src\/modules\/auth\/application\//, depth: 4, minimum: 90 },
  { pattern: /^src\/modules\/content\/application\//, depth: 4, minimum: 90 },
  { pattern: /^src\/modules\/media\/application\//, depth: 4, minimum: 90 },
  { pattern: /^src\/shared\/kernel\//, depth: 3, minimum: 80 },
];
const DETECTED = new Set(['Killed', 'Timeout']);
const COUNTED = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);

export function findWeakMutationScores(report) {
  const groups = new Map();
  for (const [path, file] of Object.entries(report.files)) {
    const bar = MUTATION_BARS.find(({ pattern }) => pattern.test(path));
    if (!bar) continue;
    const group = path.split('/').slice(0, bar.depth).join('/');
    const entry = groups.get(group) ?? { minimum: bar.minimum, detected: 0, total: 0 };
    for (const { status } of file.mutants) {
      if (!COUNTED.has(status)) continue;
      entry.total += 1;
      if (DETECTED.has(status)) entry.detected += 1;
    }
    groups.set(group, entry);
  }
  return [...groups].flatMap(([group, { minimum, detected, total }]) => {
    const score = total === 0 ? 100 : (detected / total) * 100;
    return score < minimum
      ? [`M-TEST-07 ${group} scores ${score.toFixed(1)}, below ${String(minimum)}`]
      : [];
  });
}

export function findMissingStrictFlags(tsconfig) {
  const options = tsconfig.compilerOptions ?? {};
  return REQUIRED_STRICT_FLAGS.filter((flag) => options[flag] !== true);
}

const sumGzip = (files) => files.reduce((total, file) => total + file.gzipBytes, 0);
const formatKb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

export function checkBundleBudgets(files) {
  const violations = [];
  const initial = sumGzip(files.filter((file) => file.kind === 'initial'));
  const css = sumGzip(files.filter((file) => file.kind === 'css'));

  if (initial > INITIAL_BUDGET) violations.push(`M-BUN-01 initial JS is ${formatKb(initial)}`);
  for (const file of files) {
    if (file.kind === 'route' && file.gzipBytes > ROUTE_BUDGET) {
      violations.push(`M-BUN-02 ${file.name} is ${formatKb(file.gzipBytes)}`);
    }
  }
  if (css > CSS_BUDGET) violations.push(`M-BUN-03 CSS is ${formatKb(css)}`);
  return violations;
}

export function findUnlinkedTodos(text) {
  const unlinked = [];
  text.split('\n').forEach((line, index) => {
    if (/\b(TODO|FIXME)\b/.test(line) && !/CMS-\d+/.test(line)) unlinked.push(index + 1);
  });
  return unlinked;
}

export function isLicenseAllowed(expression) {
  const normalized = expression.replace(/[()]/g, '').trim();
  if (normalized.includes(' AND ')) return normalized.split(' AND ').every(isLicenseAllowed);
  return normalized.split(' OR ').some((license) => ALLOWED_LICENSES.has(license.trim()));
}

// ADR-0015: the prebuilt libvips binaries sharp loads as a separate library, unmodified. An exception
// names both the package and its exact license, so any other LGPL dependency still fails.
const LICENSE_EXCEPTIONS = [
  {
    name: /^@img\/sharp-(libvips-)?[a-z0-9-]+$/,
    licenses: new Set(['LGPL-3.0-or-later', 'Apache-2.0 AND LGPL-3.0-or-later']),
  },
];

function isLicenseExcepted(name, license) {
  return LICENSE_EXCEPTIONS.some((rule) => rule.name.test(name) && rule.licenses.has(license));
}

export function findDisallowedLicenses(report) {
  return Object.entries(report).flatMap(([license, packages]) =>
    isLicenseAllowed(license)
      ? []
      : packages
          .filter((pkg) => !isLicenseExcepted(pkg.name, license))
          .map((pkg) => `${pkg.name} (${license})`),
  );
}

const isTestPath = (path) => /\.spec\.tsx?$/.test(path) || /(^|\/)test\//.test(path);
const isCodePath = (path) => /\.tsx?$/.test(path) && !/\.generated\.ts$/.test(path);
const isSourcePath = (path) => /^cms-(api|web)\//.test(path) && isCodePath(path);

export function evaluateTestRatio(numstat) {
  let productionLoc = 0;
  let testLoc = 0;

  for (const row of numstat.split('\n').filter(Boolean)) {
    const [added, , path] = row.split('\t');
    if (!isSourcePath(path)) continue;
    const lines = added === '-' ? 0 : Number(added);
    if (isTestPath(path)) testLoc += lines;
    else productionLoc += lines;
  }

  const ratio = productionLoc === 0 ? 1 : testLoc / productionLoc;
  let reason = '';
  if (productionLoc > 0 && testLoc === 0) reason = 'M-TDD-06 production code changed with no tests';
  else if (ratio < 1) reason = `M-TDD-01 test-to-code ratio ${ratio.toFixed(2)} is below 1.0`;
  return { productionLoc, testLoc, ratio, ok: reason === '', reason };
}

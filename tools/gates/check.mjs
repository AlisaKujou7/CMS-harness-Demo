// Runs one repository check: node tools/gates/check.mjs <name>
// Exit codes: 0 pass, 1 fail, 78 skipped because a prerequisite is missing.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  checkBundleBudgets,
  evaluateTestRatio,
  findDisallowedLicenses,
  findMissingStrictFlags,
  findPortsWithoutFakes,
  findUnlinkedTodos,
  findUntestedUseCases,
  findUntracedRequirements,
  findWeakMutationScores,
} from './checks.mjs';

const EXIT_SKIP = 78;
const ROOT = join(import.meta.dirname, '..', '..');

const run = (command) =>
  spawnSync(command, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function report(violations) {
  for (const violation of violations) console.error(violation);
  return violations.length === 0 ? 0 : 1;
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const checks = {
  strict() {
    const config = JSON.parse(readFileSync(join(ROOT, 'tsconfig.base.json'), 'utf8'));
    return report(findMissingStrictFlags(config).map((flag) => `Missing strict flag: ${flag}`));
  },

  bundle() {
    const dist = join(ROOT, 'cms-web', 'dist');
    if (!existsSync(join(dist, 'index.html'))) {
      console.error('cms-web/dist is missing: run the build first');
      return 1;
    }
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const files = [...walk(join(dist, 'assets'))]
      .filter((path) => /\.(js|css)$/.test(path))
      .map((path) => {
        const name = relative(dist, path).replaceAll('\\', '/');
        const entry = html.includes(name);
        const kind = name.endsWith('.css') ? 'css' : entry ? 'initial' : 'route';
        return { name, kind, gzipBytes: gzipSync(readFileSync(path)).length };
      });
    for (const file of files) {
      console.log(`${file.kind.padEnd(8)}${(file.gzipBytes / 1024).toFixed(1)} KB  ${file.name}`);
    }
    return report(checkBundleBudgets(files));
  },

  // The optional path is for the self-test, which plants a code that nothing traces.
  traceability() {
    const srs = process.argv[3] ?? 'AIAGENT_POC/02-Software-Requirements-Specification.md';
    const isTest = (path) => /[\\/]test[\\/]|\.spec\.tsx?$/.test(path);
    const tests = ['cms-api/src', 'cms-api/test', 'cms-web/src', 'cms-web/test'].flatMap((source) =>
      [...walk(join(ROOT, source))]
        .filter((path) => /\.tsx?$/.test(path) && isTest(path))
        .map((path) => readFileSync(path, 'utf8')),
    );
    const exceptions = JSON.parse(
      readFileSync(join(ROOT, 'tools/gates/traceability-exceptions.json'), 'utf8'),
    );
    return report(
      findUntracedRequirements(readFileSync(join(ROOT, srs), 'utf8'), tests, exceptions),
    );
  },

  todos() {
    const sources = ['cms-api/src', 'cms-api/test', 'cms-web/src', 'cms-web/test'];
    const violations = sources.flatMap((source) =>
      [...walk(join(ROOT, source))]
        .filter((path) => /\.tsx?$/.test(path))
        .flatMap((path) =>
          findUnlinkedTodos(readFileSync(path, 'utf8')).map(
            (line) => `M-DEBT-02 ${relative(ROOT, path)}:${String(line)} has no CMS-### issue`,
          ),
        ),
    );
    return report(violations);
  },

  licenses() {
    const result = run('pnpm licenses list --prod --json --recursive');
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      return 1;
    }
    const output = result.stdout.trim();
    return report(output === '' ? [] : findDisallowedLicenses(JSON.parse(output)));
  },

  architecture() {
    const api = join(ROOT, 'cms-api');
    const files = (dir, test) => [...walk(join(api, dir))].filter((path) => test.test(path));
    const read = (paths) => paths.map((path) => readFileSync(path, 'utf8'));

    const ports = [...files('src', /[\\/]ports[\\/](out[\\/])?[^\\/]+\.port\.ts$/)].filter(
      (path) => !/[\\/]ports[\\/]in[\\/]/.test(path),
    );
    const missingFakes = findPortsWithoutFakes(read(ports), read(files('test/fakes', /\.ts$/)));
    const useCases = files('src/modules', /\.use-case\.ts$/).map((path) =>
      path.split(/[\\/]/).at(-1).replace(/\.ts$/, ''),
    );
    const untested = findUntestedUseCases(useCases, read(files('src', /\.spec\.ts$/)));

    return report([
      ...missingFakes.map((port) => `M-HEX-06 port ${port} has no fake in test/fakes`),
      ...untested.map((name) => `M-HEX-07 use case ${name} has no spec importing it`),
    ]);
  },

  mutation() {
    const path = join(ROOT, 'cms-api', 'reports', 'mutation', 'mutation.json');
    if (!existsSync(path)) {
      console.error('No mutation report: run the mutation tests first');
      return 1;
    }
    return report(findWeakMutationScores(JSON.parse(readFileSync(path, 'utf8'))));
  },

  ratio() {
    if (!existsSync(join(ROOT, '.git'))) {
      console.error('Not a git repository yet');
      return EXIT_SKIP;
    }
    const base = process.env.GATE_BASE_REF ?? 'origin/main';
    const diff = run(`git diff --numstat ${base}...HEAD`);
    if (diff.status !== 0) {
      console.error(`Cannot diff against ${base}: ${diff.stderr}`);
      return EXIT_SKIP;
    }
    const result = evaluateTestRatio(diff.stdout);
    console.log(`production ${String(result.productionLoc)}, tests ${String(result.testLoc)}`);
    return report(result.ok ? [] : [result.reason]);
  },

  secrets() {
    if (run('gitleaks version').status !== 0) {
      console.error('gitleaks is not installed');
      return EXIT_SKIP;
    }
    // Scans commit history. The pre-commit hook covers staged files, and ignored local files such
    // as .env are not part of the repository.
    const result = run('gitleaks git --no-banner .');
    console.error(result.stdout + result.stderr);
    return result.status === 0 ? 0 : 1;
  },
};

const name = process.argv[2];
const check = checks[name];
if (!check) {
  console.error(`Unknown check "${name}". Available: ${Object.keys(checks).join(', ')}`);
  process.exit(1);
}
process.exit(check());

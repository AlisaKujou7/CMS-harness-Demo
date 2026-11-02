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
  findUnlinkedTodos,
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
    const result = run('gitleaks detect --no-banner --no-git --source .');
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

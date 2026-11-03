// Local and CI entry point for the G-03 PR gate in 05-METRICS 11.4.
//   node tools/gates/run-gate.mjs            every step
//   node tools/gates/run-gate.mjs --fast     skips the slow and network steps
//   node tools/gates/run-gate.mjs --only=a,b the named steps
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { workingTree, writeGateStamp } from './git-guard.mjs';

const EXIT_SKIP = 78;
const ROOT = join(import.meta.dirname, '..', '..');

const STEPS = [
  { id: 'format', label: 'Prettier', command: 'pnpm format:check' },
  { id: 'strict', label: 'TypeScript strict flags', command: 'node tools/gates/check.mjs strict' },
  { id: 'types', label: 'TypeScript compile', command: 'pnpm typecheck' },
  { id: 'lint', label: 'ESLint and complexity', command: 'pnpm lint' },
  {
    id: 'arch',
    label: 'Architecture rules',
    command: 'pnpm depcruise && node tools/gates/check.mjs architecture',
  },
  { id: 'todos', label: 'Unlinked TODO/FIXME', command: 'node tools/gates/check.mjs todos' },
  { id: 'tools', label: 'Gate tool tests', command: 'pnpm test:tools' },
  { id: 'openapi', label: 'OpenAPI lint', command: 'pnpm openapi:lint' },
  { id: 'coverage', label: 'All tests and coverage', command: 'pnpm test:cov' },
  { id: 'duplication', label: 'Duplication', command: 'pnpm dup' },
  { id: 'ratio', label: 'Test-to-code ratio', command: 'node tools/gates/check.mjs ratio' },
  { id: 'secrets', label: 'Secret scan', command: 'node tools/gates/check.mjs secrets' },
  {
    id: 'mutation',
    label: 'Mutation testing',
    command: 'pnpm test:mutation && node tools/gates/check.mjs mutation',
    slow: true,
  },
  {
    id: 'bundle',
    label: 'Build and bundle budgets',
    command: 'pnpm --filter cms-web build && node tools/gates/check.mjs bundle',
    slow: true,
  },
  { id: 'e2e', label: 'End-to-end flows', command: 'pnpm test:e2e', slow: true },
  { id: 'audit', label: 'Dependency CVEs', command: 'pnpm audit --audit-level high', slow: true },
  {
    id: 'licenses',
    label: 'License allow-list',
    command: 'node tools/gates/check.mjs licenses',
    slow: true,
  },
];

function selectSteps(args) {
  const only = args.find((arg) => arg.startsWith('--only='));
  if (only) {
    const ids = only.slice('--only='.length).split(',');
    const unknown = ids.filter((id) => !STEPS.some((step) => step.id === id));
    if (unknown.length > 0) throw new Error(`Unknown gate steps: ${unknown.join(', ')}`);
    return STEPS.filter((step) => ids.includes(step.id));
  }
  return args.includes('--fast') ? STEPS.filter((step) => !step.slow) : STEPS;
}

function runStep(step) {
  console.log(`\n===== ${step.label} =====`);
  const startedAt = performance.now();
  const { status } = spawnSync(step.command, { cwd: ROOT, shell: true, stdio: 'inherit' });
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  const outcome = status === 0 ? 'PASS' : status === EXIT_SKIP ? 'SKIP' : 'FAIL';
  return { label: step.label, outcome, seconds };
}

const args = process.argv.slice(2);
// Taken first, so an edit made while the gate runs does not count as checked.
const treeAtStart = args.length === 0 ? workingTree(ROOT) : null;
const results = selectSteps(args).map(runStep);

console.log('\n===== Quality Gate Report =====');
for (const { label, outcome, seconds } of results) {
  console.log(`${outcome.padEnd(6)}${label.padEnd(30)}${seconds}s`);
}

const failed = results.filter((result) => result.outcome === 'FAIL');
const skipped = results.filter((result) => result.outcome === 'SKIP');
if (failed.length > 0) console.log(`\nRESULT: FAIL (${String(failed.length)} failed)`);
else if (skipped.length > 0) console.log(`\nRESULT: PASS WITH ${String(skipped.length)} SKIPPED`);
else console.log('\nRESULT: PASS');
// Only a full run counts, and the Claude Code hook reads this before a commit.
if (treeAtStart !== null && failed.length === 0) writeGateStamp(ROOT, treeAtStart);
process.exit(failed.length > 0 ? 1 : 0);

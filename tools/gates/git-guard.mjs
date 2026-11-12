// What the Claude Code hook in .claude/hooks/guard-git.mjs decides, and the record of the last gate
// that passed. An agent can forget an agreement, so these rules run outside it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const STAMP_PATH = 'reports/gate-pass.json';

// Message text often names these commands, so quoted strings do not count.
function withoutQuotedText(command) {
  return command.replace(/"(?:[^"\\]|\\[\s\S])*"|'[^']*'/g, '""');
}

// Options may come between `git` and its subcommand, as in `git -C dir commit`.
const gitRunning = (subcommand) =>
  new RegExp(`\\bgit\\b(?:\\s+-{1,2}\\S+(?:\\s+[^\\s-]\\S*)?)*\\s+${subcommand}\\b`);

const SKIPS_HOOKS = /--no-verify|core\.hookspath|\bcommit\b[^;&|\n]*\s-[a-z]*n[a-z]*(?:\s|$)/i;
// The start of the first -m message, written directly or through a heredoc.
const TDD_STEP = /\s-[a-z]*m\s+["'](?:\$\(cat\s+<<-?\s*['"]?\w+['"]?\s+)?(red|green)\(/;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$|(?:^|\/)test\//;

export function classifyGitCommand(command) {
  const code = withoutQuotedText(command);
  const commits = gitRunning('commit').test(code);
  const pushes = gitRunning('push').test(code);
  return {
    commits,
    pushes,
    skipsHooks: (commits || pushes) && SKIPS_HOOKS.test(code),
    tddStep: commits ? (TDD_STEP.exec(command)?.[1] ?? null) : null,
  };
}

const deny = (reason) => ({ decision: 'deny', reason });
const NO_STATE = 'No readable docs/harness/state.json. Record the Ticket and its Contract there.';

function decideRed({ stagedFiles, state }) {
  if (state === null || state === undefined) return deny(NO_STATE);
  if (typeof state.approved !== 'string' || state.approved.trim() === '') {
    return deny(`The Contract of ${String(state.ticket)} is not approved. Ask the user first.`);
  }
  if (stagedFiles.some((file) => TEST_FILE.test(file))) return { decision: 'allow' };
  return deny('A red commit needs a test file staged. Run `git add` first, in a separate command.');
}

function decideGreen({ stagedFiles, headSubject, state }) {
  if (!/^(?:red|green)\(/.test(headSubject)) {
    return deny('A green commit must follow a red commit on this branch.');
  }
  if (state === null || state === undefined) return deny(NO_STATE);
  const outside = filesOutsideContract(stagedFiles, state.files);
  if (outside.length === 0) return { decision: 'allow' };
  const listed = outside.slice(0, 5).join(', ');
  return deny(`Outside the Contract of ${String(state.ticket)}: ${listed}. Stop and ask the user.`);
}

// A failing test cannot pass a gate, so these two steps are held to their own rules, and the next
// ordinary commit is what needs the gate. That keeps a task from ending on them. Both read
// docs/harness/state.json too: red needs an approved Contract, and green stays inside its files.
function decideTddStep(step, tdd) {
  return step === 'red' ? decideRed(tdd) : decideGreen(tdd);
}

// `changedSinceGate` is null when no gate has passed, or its tree is no longer known.
export function decideGitCommand(command, changedSinceGate, tdd) {
  const { commits, pushes, skipsHooks, tddStep } = classifyGitCommand(command);
  if (skipsHooks) {
    return { decision: 'deny', reason: 'Git hooks may not be skipped. Fix what they report.' };
  }
  if (pushes) return { decision: 'ask', reason: 'Pushing needs the user to approve it each time.' };
  if (!commits) return { decision: 'allow' };
  if (tddStep !== null) return decideTddStep(tddStep, tdd);
  if (changedSinceGate === null) {
    return { decision: 'deny', reason: 'No full gate has passed. Run `pnpm gate` first.' };
  }
  // Documents have their own check in the pre-commit hook, and a full gate takes minutes.
  const stale = changedSinceGate.filter((file) => !file.endsWith('.md'));
  if (stale.length === 0) return { decision: 'allow' };
  const listed = stale.slice(0, 5).join(', ');
  return {
    decision: 'deny',
    reason: `Files changed since the last passing gate (${listed}). Run \`pnpm gate\` again.`,
  };
}

function git(root, args, env = process.env) {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}

// The working tree as if all of it were committed, through a separate index so that what is staged
// stays as it is. Splitting one gated change into several commits keeps the same tree.
export function workingTree(root) {
  const dir = mkdtempSync(join(tmpdir(), 'cms-gate-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
    git(root, ['read-tree', 'HEAD'], env);
    git(root, ['add', '--all'], env);
    return git(root, ['write-tree'], env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function tddContext(root) {
  const staged = git(root, ['diff', '--cached', '--name-only']);
  return {
    stagedFiles: staged === '' ? [] : staged.split('\n'),
    headSubject: git(root, ['log', '-1', '--format=%s']),
    state: readWorkflowState(root),
  };
}

export const STATE_PATH = 'docs/harness/state.json';

// The Ticket in progress, as the hook reads it. Null when missing or unreadable, so the hook refuses
// rather than guesses.
export function readWorkflowState(root) {
  const path = join(root, STATE_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// An entry that ends in a slash allows everything under that folder.
export function filesOutsideContract(files, allowed = []) {
  const inside = (file) =>
    allowed.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
  return files.filter((file) => !inside(file));
}

export function writeGateStamp(root, tree) {
  const path = join(root, STAMP_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ tree }));
}

export function changedSinceGate(root) {
  const path = join(root, STAMP_PATH);
  if (!existsSync(path)) return null;
  const { tree } = JSON.parse(readFileSync(path, 'utf8'));
  try {
    const changed = git(root, ['diff', '--name-only', tree, workingTree(root)]);
    return changed === '' ? [] : changed.split('\n');
  } catch {
    return null;
  }
}

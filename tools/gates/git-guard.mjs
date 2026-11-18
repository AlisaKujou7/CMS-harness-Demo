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
// Husky skips every git hook when HUSKY is 0, written as VAR=0, export or $env:HUSKY='0'.
const SKIPS_HOOKS_BY_ENV = /\bHUSKY\s*=\s*['"]?0(?![\w.])/i;
// The first -m flag, and a message that opens with red( or green(, directly or through a heredoc.
const FIRST_MESSAGE = /\s-[a-z]*m\s+/;
const TDD_STEP = /^["'](?:\$\(cat\s+<<-?\s*['"]?\w+['"]?\s+)?(red|green)\(/;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$|(?:^|\/)test\//;

// Only the first message decides, so a later -m "red(...)" cannot turn a commit into a TDD step.
function firstMessageStep(command) {
  const flag = FIRST_MESSAGE.exec(command);
  if (flag === null) return null;
  return TDD_STEP.exec(command.slice(flag.index + flag[0].length))?.[1] ?? null;
}

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/;
// Programs that run what a heredoc gives them. For any other program the body is data.
const RUNS_HEREDOC = new Set(['git', 'bash', 'sh', 'zsh', 'dash', 'eval', 'pwsh', 'powershell']);

// The program a piece of a command line starts with, past VAR=value and env.
function programOf(words) {
  const word = words.find((each) => !/^\w+=/.test(each) && each !== 'env') ?? '';
  return word
    .replace(/^.*[/\\]/, '')
    .replace(/\.exe$/i, '')
    .toLowerCase();
}

// A file being written, as in `cat > notes.md <<'EOF'`, often holds the words git commit.
function withoutDataHeredocs(command) {
  const lines = command.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    kept.push(lines[i]);
    const match = HEREDOC.exec(lines[i]);
    const end = match ? lines.findIndex((line, j) => j > i && line.trim() === match[2]) : -1;
    const before = match
      ? lines[i]
          .slice(0, match.index)
          .split(/[;&|(]/)
          .pop()
      : '';
    if (end !== -1 && !RUNS_HEREDOC.has(programOf(before.trim().split(/\s+/)))) i = end - 1;
  }
  return kept.join('\n');
}

// The text of a quoted string that starts at `start`, and where it ends.
function readQuoted(command, start) {
  const quote = command.charAt(start);
  let text = '';
  let at = start + 1;
  while (at < command.length && command.charAt(at) !== quote) {
    const escaped = quote === '"' && command.charAt(at) === '\\' && at + 1 < command.length;
    text += escaped ? command.charAt(at + 1) : command.charAt(at);
    at += escaped ? 2 : 1;
  }
  return { text, end: at };
}

// Splits a command line at ; & | and line breaks outside quotes, keeping the words and the text
// of the quoted strings of each piece.
function piecesOf(command) {
  const pieces = [];
  let piece = { words: [], quoted: [] };
  let word = '';
  const endWord = () => {
    if (word !== '') piece.words.push(word);
    word = '';
  };
  for (let at = 0; at < command.length; at += 1) {
    const character = command.charAt(at);
    if (character === '"' || character === "'") {
      const { text, end } = readQuoted(command, at);
      piece.quoted.push(text);
      word += '""';
      at = end;
    } else if (/[;&|\n]/.test(character)) {
      endWord();
      pieces.push(piece);
      piece = { words: [], quoted: [] };
    } else if (/\s/.test(character)) endWord();
    else word += character;
  }
  endWord();
  return [...pieces, piece].filter(({ words }) => words.length > 0);
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const POWERSHELLS = new Set(['pwsh', 'powershell']);
// Programs that only show or search text, so a quoted git commit there is not run.
const SHOWS_TEXT = new Set(['echo', 'printf', 'grep', 'egrep', 'rg', 'git', 'select-string']);
const MENTIONS_GIT = /\bgit\s+(?:-\S+\s+)*(?:commit|push)\b/;

function runsItsStrings({ words }) {
  const program = programOf(words);
  const flags = words.map((word) => word.toLowerCase());
  if (SHELLS.has(program)) return flags.some((flag) => /^-[a-z]*c$/.test(flag));
  if (POWERSHELLS.has(program)) return flags.some((flag) => /^-c(?:ommand)?$/.test(flag));
  if (program === 'cmd') return flags.includes('/c') || flags.includes('/k');
  return program === 'eval';
}

const MAX_DEPTH = 3;

// Reads the strings that bash -c, sh -c, eval, pwsh -Command and cmd /c run, as commands of their
// own. A quoted git commit or push given to any other program is marked hidden, so the hook asks.
function readInnerCommands(visible, depth) {
  const found = { commits: false, pushes: false, skipsHooks: false, tddStep: null, hidden: false };
  for (const piece of piecesOf(visible)) {
    if (!runsItsStrings(piece)) {
      const shown = SHOWS_TEXT.has(programOf(piece.words));
      found.hidden ||= !shown && piece.quoted.some((text) => MENTIONS_GIT.test(text));
      continue;
    }
    for (const inner of depth < MAX_DEPTH ? piece.quoted : []) {
      const result = classifyGitCommand(inner, depth + 1);
      found.commits ||= result.commits;
      found.pushes ||= result.pushes;
      found.skipsHooks ||= result.skipsHooks;
      found.tddStep ??= result.tddStep;
      found.hidden ||= result.hidden;
    }
  }
  return found;
}

// Options that commit files beyond the index, and options whose value is the next word.
const WIDENS = /^-[a-zA-Z]*[aio][a-zA-Z]*$|^--(?:all|include|only)$/;
const TAKES_VALUE =
  /^-[a-zA-Z]*[mFCct]$|^--(?:message|file|author|date|template|reuse-message|reedit-message|fixup|squash|trailer|cleanup)$/;
const REDIRECT = /^\d*[<>]/;

// True when the commit takes files that are not staged: -a, --include, --only or a path. The hook
// checks the staged files, so a red or green commit must commit exactly those.
function addsUnstagedFiles(code) {
  const match = gitRunning('commit').exec(code);
  const words = code
    .slice(match.index + match[0].length)
    .split(/[;&|\n]/)[0]
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (REDIRECT.test(word)) {
      if (/^\d*[<>]+$/.test(word)) i += 1;
    } else if (word === '--') {
      return i + 1 < words.length;
    } else if (WIDENS.test(word)) {
      return true;
    } else if (TAKES_VALUE.test(word)) {
      i += 1;
    } else if (!word.startsWith('-')) {
      return true;
    }
  }
  return false;
}

export function classifyGitCommand(command, depth = 0) {
  const visible = withoutDataHeredocs(command);
  const code = withoutQuotedText(visible);
  const inner = readInnerCommands(visible, depth);
  const direct = gitRunning('commit').test(code);
  const commits = direct || inner.commits;
  const pushes = gitRunning('push').test(code) || inner.pushes;
  const skips = SKIPS_HOOKS.test(code) || SKIPS_HOOKS_BY_ENV.test(visible) || inner.skipsHooks;
  return {
    commits,
    pushes,
    skipsHooks: (commits || pushes) && skips,
    tddStep: commits ? ((direct ? firstMessageStep(command) : null) ?? inner.tddStep) : null,
    addsUnstaged: direct && addsUnstagedFiles(code),
    hidden: inner.hidden,
  };
}

const deny = (reason) => ({ decision: 'deny', reason });
const HIDDEN = 'A program runs a quoted git commit or push that the hook cannot read. Approve it.';
const SECRETS_SKIPPED =
  'The last gate skipped the secret scan. Install gitleaks and run `pnpm gate` again.';
const NO_STATE = 'No readable docs/harness/state.json. Record the Ticket and its Contract there.';

function decideRed({ stagedFiles, state }) {
  if (state === null || state === undefined) return deny(NO_STATE);
  if (typeof state.approved !== 'string' || state.approved.trim() === '') {
    return deny(`The Contract of ${String(state.ticket)} is not approved. Ask the user first.`);
  }
  if (stagedFiles.some((file) => TEST_FILE.test(file))) return { decision: 'allow' };
  return deny('A red commit needs a test file staged. Run `git add` first, in a separate command.');
}

// The Contract as committed at HEAD, so a green commit cannot widen its own scope.
function decideGreen({ stagedFiles, headSubject, headState }) {
  if (!/^(?:red|green)\(/.test(headSubject)) {
    return deny('A green commit must follow a red commit on this branch.');
  }
  if (headState === null || headState === undefined) {
    return deny(`No readable ${STATE_PATH} at HEAD. It is committed with red.`);
  }
  const outside = filesOutsideContract(stagedFiles, headState.files);
  if (outside.length === 0) return { decision: 'allow' };
  const listed = outside.slice(0, 5).join(', ');
  const ticket = String(headState.ticket);
  return deny(`Outside the Contract of ${ticket}: ${listed}. Stop and ask the user.`);
}

// A failing test cannot pass a gate, so these two steps are held to their own rules, and the next
// ordinary commit is what needs the gate. That keeps a task from ending on them. Both read
// docs/harness/state.json too: red needs an approved Contract, and green stays inside its files.
function decideTddStep(step, addsUnstaged, tdd) {
  if (addsUnstaged) {
    return deny(
      'A red or green commit takes only what is staged. Drop -a and paths, and `git add` first.',
    );
  }
  return step === 'red' ? decideRed(tdd) : decideGreen(tdd);
}

// `changedSinceGate` is null when no gate has passed, or its tree is no longer known.
export function decideGitCommand(command, changedSinceGate, tdd) {
  const { commits, pushes, skipsHooks, tddStep, addsUnstaged, hidden } =
    classifyGitCommand(command);
  if (skipsHooks) {
    return { decision: 'deny', reason: 'Git hooks may not be skipped. Fix what they report.' };
  }
  if (pushes) return { decision: 'ask', reason: 'Pushing needs the user to approve it each time.' };
  if (!commits) return hidden ? { decision: 'ask', reason: HIDDEN } : { decision: 'allow' };
  if (tddStep !== null) return decideTddStep(tddStep, addsUnstaged, tdd);
  if (changedSinceGate === null) {
    return { decision: 'deny', reason: 'No full gate has passed. Run `pnpm gate` first.' };
  }
  if (tdd?.gateSkipped?.includes('secrets')) return deny(SECRETS_SKIPPED);
  // Documents have their own check in the pre-commit hook, and a full gate takes minutes. The
  // specifications are read by the traceability step, so a change to them needs the gate.
  const stale = changedSinceGate.filter(
    (file) => !file.endsWith('.md') || file.startsWith('AIAGENT_POC/'),
  );
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

// --no-renames lists both sides of a move, so a file cannot leave the Contract by being renamed.
export function tddContext(root) {
  const staged = git(root, ['diff', '--cached', '--name-only', '--no-renames']);
  return {
    stagedFiles: staged === '' ? [] : staged.split('\n'),
    headSubject: git(root, ['log', '-1', '--format=%s']),
    state: readWorkflowState(root),
    headState: readCommittedState(root),
    gateSkipped: readGateSkipped(root),
  };
}

export const STATE_PATH = 'docs/harness/state.json';

// Null for anything but a JSON object, so the hook refuses rather than guesses.
function parseState(text) {
  try {
    const state = JSON.parse(text);
    return typeof state === 'object' && state !== null && !Array.isArray(state) ? state : null;
  } catch {
    return null;
  }
}

// The Ticket in progress, as it stands in the working copy.
export function readWorkflowState(root) {
  const path = join(root, STATE_PATH);
  return existsSync(path) ? parseState(readFileSync(path, 'utf8')) : null;
}

function readCommittedState(root) {
  const result = spawnSync('git', ['show', `HEAD:${STATE_PATH}`], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? parseState(result.stdout) : null;
}

// An entry that ends in a slash allows everything under that folder. Anything else in the list,
// or a list that is not one, allows nothing.
export function filesOutsideContract(files, allowed) {
  const entries = Array.isArray(allowed)
    ? allowed.filter((entry) => typeof entry === 'string')
    : [];
  const inside = (file) =>
    entries.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
  return files.filter((file) => !inside(file));
}

export function writeGateStamp(root, tree, skipped = []) {
  const path = join(root, STAMP_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ tree, skipped }));
}

// The steps the last full gate skipped. An older stamp without the list counts as none skipped.
export function readGateSkipped(root) {
  const path = join(root, STAMP_PATH);
  if (!existsSync(path)) return [];
  try {
    const { skipped } = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(skipped) ? skipped.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
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

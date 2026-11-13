import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  STATE_PATH,
  classifyGitCommand,
  decideGitCommand,
  filesOutsideContract,
  readWorkflowState,
  tddContext,
} from './git-guard.mjs';

describe('classifyGitCommand', () => {
  it('finds a commit however the command is written', () => {
    for (const command of [
      'git commit -m "x"',
      'cd cms-api && git commit -m "x"',
      'git -C "E:/Harness Project" commit -m "x"',
      'git -c user.name=me commit --amend',
    ]) {
      assert.equal(classifyGitCommand(command).commits, true, command);
    }
  });

  it('is not fooled by text that only mentions a commit or push', () => {
    for (const command of [
      'git status',
      'git log --oneline',
      'echo "git commit and git push"',
      "grep 'git commit' README.md",
      'pnpm test:commit',
    ]) {
      const { commits, pushes } = classifyGitCommand(command);
      assert.deepEqual({ commits, pushes }, { commits: false, pushes: false }, command);
    }
  });

  it('finds every way of skipping hooks', () => {
    for (const command of [
      'git commit --no-verify -m "x"',
      'git commit -n -m "x"',
      'git commit -anm "x"',
      'git -c core.hooksPath=/dev/null commit -m "x"',
      'git push --no-verify',
    ]) {
      assert.equal(classifyGitCommand(command).skipsHooks, true, command);
    }
  });

  it('does not read other flags as skipping hooks', () => {
    assert.equal(classifyGitCommand('git commit -m "no-verify"').skipsHooks, false);
    assert.equal(classifyGitCommand('git status --no-verify').skipsHooks, false);
  });
});

describe('decideGitCommand', () => {
  const decision = (command, changed) => decideGitCommand(command, changed).decision;

  it('leaves other commands alone, whatever the gate says', () => {
    assert.equal(decision('pnpm test', null), 'allow');
  });

  it('refuses a commit when no gate has passed', () => {
    assert.equal(decision('git commit -m "x"', null), 'deny');
  });

  it('allows a commit of exactly what the gate saw', () => {
    assert.equal(decision('git commit -m "x"', []), 'allow');
  });

  it('allows a commit when only documents changed since', () => {
    assert.equal(decision('git commit -m "x"', ['docs/a.md', 'README.md']), 'allow');
  });

  it('refuses a commit and names the code changed since', () => {
    const result = decideGitCommand('git commit -m "x"', ['docs/a.md', 'cms-api/src/main.ts']);

    assert.equal(result.decision, 'deny');
    assert.match(result.reason, /cms-api\/src\/main\.ts/);
    assert.doesNotMatch(result.reason, /docs\/a\.md/);
  });

  it('refuses skipping hooks even after a passing gate', () => {
    assert.equal(decision('git commit --no-verify -m "x"', []), 'deny');
  });

  it('asks before any push', () => {
    assert.equal(decision('git push origin main', []), 'ask');
  });

  describe('TDD steps, which cannot pass a gate yet', () => {
    const red = 'git commit -m "red(shared): log each request"';
    const green = 'git commit -m "green(shared): log each request"';
    const state = {
      ticket: 'T-9',
      step: 'red',
      approved: '2026-11-12',
      files: ['a.ts', 'a.spec.ts'],
    };
    const decide = (command, stagedFiles, headSubject = 'feat(a): b') =>
      decideGitCommand(command, null, { stagedFiles, headSubject, state, headState: state })
        .decision;

    it('allows a red commit that holds a test, without a gate', () => {
      assert.equal(decide(red, ['cms-api/src/a.spec.ts', 'cms-api/src/a.ts']), 'allow');
      assert.equal(decide(red, ['cms-api/test/integration/a.ts']), 'allow');
    });

    it('refuses a red commit with no test staged', () => {
      assert.equal(decide(red, ['cms-api/src/a.ts']), 'deny');
      assert.equal(decide(red, []), 'deny');
    });

    it('allows green only straight after red or green', () => {
      assert.equal(decide(green, ['a.ts'], 'red(shared): x'), 'allow');
      assert.equal(decide(green, ['a.ts'], 'green(shared): x'), 'allow');
      assert.equal(decide(green, ['a.ts'], 'feat(shared): x'), 'deny');
    });

    it('still skips no hooks', () => {
      assert.equal(decide('git commit --no-verify -m "red(a): b"', ['a.spec.ts']), 'deny');
    });

    it('reads a message passed through a heredoc', () => {
      const command = `git commit -m "$(cat <<'EOF'\nred(shared): x\nEOF\n)"`;
      assert.equal(classifyGitCommand(command).tddStep, 'red');
    });

    it('holds an ordinary commit to the gate, even one that mentions red', () => {
      assert.equal(classifyGitCommand('git commit -m "fix(a): red(b) text"').tddStep, null);
      assert.equal(decide('git commit -m "fix(a): b"', ['a.spec.ts']), 'deny');
    });
  });
});

describe('workflow state from docs/harness/state.json', () => {
  const red = 'git commit -m "red(ci): x"';
  const green = 'git commit -m "green(ci): x"';
  const approved = { ticket: 'T-9', step: 'red', approved: '2026-11-12', files: ['a.ts', 'src/'] };
  const decide = (command, state, stagedFiles, headSubject = 'red(ci): x') =>
    decideGitCommand(command, null, { stagedFiles, headSubject, state, headState: state });

  it('refuses red when there is no state file', () => {
    const result = decide(red, null, ['a.spec.ts']);

    assert.equal(result.decision, 'deny');
    assert.match(result.reason, /state\.json/);
  });

  it('refuses red until the Contract has an approval date', () => {
    for (const value of [undefined, '', '  ']) {
      const result = decide(red, { ...approved, approved: value }, ['a.spec.ts']);

      assert.equal(result.decision, 'deny', String(value));
      assert.match(result.reason, /approv/i);
    }
  });

  it('refuses green that stages a file outside the Contract, and names it', () => {
    const result = decide(green, approved, ['a.ts', 'README.md']);

    assert.equal(result.decision, 'deny');
    assert.match(result.reason, /README\.md/);
    assert.doesNotMatch(result.reason, /a\.ts/);
  });

  it('refuses green when there is no state file', () => {
    assert.equal(decide(green, null, ['a.ts']).decision, 'deny');
  });

  it('still needs green to follow red, inside the Contract', () => {
    assert.equal(decide(green, approved, ['a.ts'], 'feat(ci): x').decision, 'deny');
  });
});

describe('filesOutsideContract', () => {
  it('accepts exact paths and folders that end in a slash', () => {
    assert.deepEqual(filesOutsideContract(['a.ts', 'src/b/c.ts'], ['a.ts', 'src/']), []);
  });

  it('lists what the Contract does not name', () => {
    assert.deepEqual(filesOutsideContract(['a.ts', 'ab.ts', 'srcx/d.ts'], ['a.ts', 'src/']), [
      'ab.ts',
      'srcx/d.ts',
    ]);
  });

  it('treats a missing list as an empty one', () => {
    assert.deepEqual(filesOutsideContract(['a.ts'], undefined), ['a.ts']);
  });
});

describe('readWorkflowState', () => {
  const withRoot = (state, check) => {
    const root = mkdtempSync(join(tmpdir(), 'cms-state-'));
    try {
      if (state !== undefined) {
        mkdirSync(join(root, 'docs', 'harness'), { recursive: true });
        writeFileSync(join(root, STATE_PATH), state);
      }
      check(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it('returns null when the file does not exist', () => {
    withRoot(undefined, (root) => {
      assert.equal(readWorkflowState(root), null);
    });
  });

  it('reads the ticket, step, approval and files', () => {
    const state = { ticket: 'T-9', step: 'green', approved: '2026-11-12', files: ['a.ts'] };
    withRoot(JSON.stringify(state), (root) => {
      assert.deepEqual(readWorkflowState(root), state);
    });
  });

  it('returns null for a file that is not valid JSON, so the hook refuses', () => {
    withRoot('{ not json', (root) => {
      assert.equal(readWorkflowState(root), null);
    });
  });
});

describe('review fixes for T-005', () => {
  const approved = {
    ticket: 'T-9',
    step: 'green',
    approved: '2026-11-12',
    files: ['a.ts', 'src/'],
  };
  const decide = (command, tdd) =>
    decideGitCommand(command, null, {
      stagedFiles: ['a.ts'],
      headSubject: 'red(ci): x',
      state: approved,
      headState: approved,
      ...tdd,
    });

  describe('a malformed state file fails closed', () => {
    it('treats a files value that is not a list as an empty Contract', () => {
      for (const files of [null, 'src/', 7, { a: 1 }]) {
        assert.deepEqual(filesOutsideContract(['a.ts'], files), ['a.ts'], String(files));
      }
    });

    it('ignores entries that are not strings', () => {
      assert.deepEqual(filesOutsideContract(['a.ts'], [null, 1, 'a.ts']), []);
    });

    it('refuses green when files is null instead of throwing', () => {
      const state = { ...approved, files: null };
      assert.equal(decide('git commit -m "green(ci): x"', { headState: state }).decision, 'deny');
    });

    it('reads JSON that is not an object as no state', () => {
      for (const text of ['"T-9"', '[]', 'null', '7']) {
        const root = mkdtempSync(join(tmpdir(), 'cms-state-'));
        try {
          mkdirSync(join(root, 'docs', 'harness'), { recursive: true });
          writeFileSync(join(root, STATE_PATH), text);
          assert.equal(readWorkflowState(root), null, text);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      }
    });

    it('denies a commit when the hook itself fails', () => {
      const root = mkdtempSync(join(tmpdir(), 'cms-not-a-repo-'));
      try {
        const hook = join(import.meta.dirname, '..', '..', '.claude', 'hooks', 'guard-git.mjs');
        const input = JSON.stringify({ tool_input: { command: 'git commit -m "green(ci): x"' } });
        const { stdout } = spawnSync('node', [hook, root], { input, encoding: 'utf8' });
        assert.match(stdout, /"permissionDecision":"deny"/);
        assert.match(stdout, /git guard failed/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('red and green commit only what is staged', () => {
    it('refuses -a, --all, --include, --only and paths', () => {
      for (const command of [
        'git commit -am "green(ci): x"',
        'git commit -a -m "green(ci): x"',
        'git commit --all -m "green(ci): x"',
        'git commit -i -m "green(ci): x" a.ts',
        'git commit --include -m "green(ci): x" a.ts',
        'git commit -o -m "green(ci): x" a.ts',
        'git commit -m "green(ci): x" README.md',
        'git commit -m "green(ci): x" -- README.md',
        'git commit -m "red(ci): x" a.spec.ts',
      ]) {
        const result = decide(command);
        assert.equal(result.decision, 'deny', command);
        assert.match(result.reason, /only what is staged/, command);
      }
    });

    it('allows the usual ways of writing the message', () => {
      for (const command of [
        'git commit -m "green(ci): x"',
        'git commit -q -m "green(ci): x" -m "body"',
        'git commit --author="A B <a@b.c>" -m "green(ci): x"',
        `git commit -m "$(cat <<'EOF'\ngreen(ci): x\nEOF\n)"`,
        'cd repo; git commit -m "green(ci): x" 2>&1 | tail -5',
      ]) {
        assert.equal(decide(command).decision, 'allow', command);
      }
    });
  });

  describe('green reads the Contract as committed', () => {
    it('refuses a file that only the uncommitted state allows', () => {
      const widened = { ...approved, files: [...approved.files, 'README.md'] };
      const result = decide('git commit -m "green(ci): x"', {
        stagedFiles: ['a.ts', 'README.md'],
        state: widened,
      });

      assert.equal(result.decision, 'deny');
      assert.match(result.reason, /README\.md/);
    });

    it('refuses green when HEAD has no state file', () => {
      assert.equal(decide('git commit -m "green(ci): x"', { headState: null }).decision, 'deny');
    });
  });

  describe('tddContext against a real repository', () => {
    const inRepo = (check) => {
      const root = mkdtempSync(join(tmpdir(), 'cms-repo-'));
      const git = (...args) => {
        const result = spawnSync(
          'git',
          ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args],
          { cwd: root, encoding: 'utf8' },
        );
        assert.equal(result.status, 0, result.stderr);
      };
      try {
        mkdirSync(join(root, 'docs', 'harness'), { recursive: true });
        writeFileSync(join(root, STATE_PATH), JSON.stringify({ ...approved, files: ['in/'] }));
        mkdirSync(join(root, 'out'));
        mkdirSync(join(root, 'in'));
        writeFileSync(join(root, 'out', 'x.ts'), 'export const x = 1;\n');
        git('init', '-q');
        git('add', '.');
        git('commit', '-q', '-m', 'red(ci): x');
        check(root, git);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    };

    it('lists both sides of a rename', () => {
      inRepo((root, git) => {
        git('mv', 'out/x.ts', 'in/x.ts');
        assert.deepEqual(tddContext(root).stagedFiles.sort(), ['in/x.ts', 'out/x.ts']);
      });
    });

    it('reads the state as committed at HEAD, apart from the working copy', () => {
      inRepo((root) => {
        writeFileSync(join(root, STATE_PATH), JSON.stringify({ ...approved, files: ['out/'] }));
        const context = tddContext(root);
        assert.deepEqual(context.headState.files, ['in/']);
        assert.deepEqual(context.state.files, ['out/']);
      });
    });
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyGitCommand, decideGitCommand } from './git-guard.mjs';

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
});

# ADR-0019: Close the hook gaps found in the second harness review

## Status

Accepted, pending review by the Tech Lead

## Context

A second review of the harness, written by another AI agent on 2026-11-18 against commit `96d96f1`, listed eleven findings. Checked again on `981765e`, one was already fixed and most were still open. Fed to `decideGitCommand`, `bash -c "git commit ..."`, `sh -c`, `eval`, `HUSKY=0 git commit` and `git commit -m "feat..." -m "red(...)"` were all allowed, so a commit could skip the gate or the git hooks. A gate run without gitleaks still wrote a passing stamp, a change to the specifications after the gate needed no new run although the traceability step reads them, and CI ran one step fewer than the local gate. 08-GIT-WORKFLOW 16.1 makes quality gate changes a Tech Lead decision through an ADR.

## Decision

- The hook reads the strings that `bash -c`, `sh -c`, `zsh -c`, `eval`, `pwsh -Command` and `cmd /c` run as commands of their own, up to three levels deep.
- A quoted `git commit` or `git push` given to any other program, such as `node -e`, makes the hook ask, unless the program only shows or searches text (`echo`, `printf`, `grep`, `rg`, `git`, `Select-String`).
- `HUSKY=0` counts as skipping git hooks, in any of `VAR=0`, `export` and `$env:HUSKY='0'`.
- `red` and `green` are read from the first `-m` message only.
- The body of a heredoc fed to a program other than git or a shell is data, so writing a file that mentions a commit is not a commit.
- Changes to `.md` files under `AIAGENT_POC/` need a new gate.
- The stamp records the skipped steps, and the hook refuses an ordinary commit when the secret scan was skipped.
- The CI static job also runs `openapi`, so CI covers every local step.
- `init.sh` stops when Node differs from `.nvmrc` or pnpm is missing, and warns when Docker or gitleaks is absent.
- `docs/harness/workflow.md` lets small documentation work skip the Ticket.

## Consequences

- Positive: every bypass the review showed is refused or asked about, and each one has a unit test and a `gate:self-test` case for the two most direct ones.
- Negative: the hook still reads command text. A commit written into a script file and run later, or one run by a program the hook does not know with an unquoted command, still gets past it.
- Negative: a stamp is a plain JSON file, and `writeGateStamp` is a plain function, so an agent can still forge one. Only a CI run on GitHub cannot be forged this way.
- Negative: the hook asks more often, for example before `node -e` runs a git commit.
- Negative: a `red` commit may still hold real code next to a test, because Red needs stubs that throw. A person reads the red commit.

## Alternatives Considered

Asking before any command whose raw text mentions `git commit`, rejected because `echo` and `grep` would ask every time. Signing the stamp, rejected because the key would sit on the same machine as the agent. Running the hook as a git hook only, rejected because the agent's own process is what needs the guard, and git hooks can be skipped.

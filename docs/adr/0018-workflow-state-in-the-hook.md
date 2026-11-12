# ADR-0018: Keep the workflow state where the hook can read it

## Status

Accepted, pending review by the Tech Lead

## Context

The Claude Code hook (`tools/gates/git-guard.mjs`) could check the shape of a commit and whether a full gate had passed, but not the two stops in `docs/harness/workflow.md` that matter most: that the user approved the Contract before `red`, and that `green` changes only the files the Contract names. Both lived only in the Ticket's Thai prose. The Tech Lead noted that the harness lacked State Management, and an outside review asked for these checks and for one command to start a session. 08-GIT-WORKFLOW 16.1 makes quality gate changes a Tech Lead decision through an ADR.

## Decision

- `docs/harness/state.json` holds the Ticket in progress: `ticket`, `step`, `approved` (the date) and `files` (exact paths, or folders that end in `/`).
- The hook refuses a `red` commit when the file is missing or unreadable, or `approved` is empty.
- The hook refuses a `green` commit that stages a file outside `files`, and names it. It still needs `green` to follow `red` or `green`.
- `gate:self-test` runs the real hook against a scratch repository to prove both refusals.
- `init.sh` starts a session: install, show the Ticket table, `state.json`, the branch and `git log`, then `pnpm gate:fast`.
- In Red, code a test needs but that does not exist yet is a stub that throws, so each test fails on its own.

## Consequences

- Positive: the two human stops leave a record the machine checks, and a scope slip is refused with the file name instead of being found in review.
- Negative: `state.json` is a file the agent can edit. The hook proves that an approval was recorded, not that a person gave it, so a person still compares `approved` with the Ticket and `files` with the Contract.
- Negative: every Ticket has one more file to update. An approval left in place after a Handoff would carry over to the next Ticket, so the workflow clears `approved` and `files` at the Handoff, which nothing enforces yet.
- Negative: only `red` and `green` are scope-checked. An ordinary commit after them, such as the Handoff, is held to the full gate instead.

## Alternatives Considered

Reading the approval from the Ticket's Markdown, rejected because the hook would depend on the wording of a Thai template. A signed approval, such as a commit by the user, rejected as too heavy for a demo with one person. Running the tests in the hook to prove that `red` fails, rejected in the Contract as too slow for a hook.

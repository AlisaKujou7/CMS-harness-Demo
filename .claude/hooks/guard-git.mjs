// PreToolUse hook for shell commands. The rules live in tools/gates/git-guard.mjs, with their tests.
import { join } from 'node:path';
import {
  changedSinceGate,
  classifyGitCommand,
  decideGitCommand,
  tddContext,
} from '../../tools/gates/git-guard.mjs';

// gate:self-test passes a scratch repository here. Claude Code passes nothing.
const ROOT = process.argv[2] ?? join(import.meta.dirname, '..', '..');

function answer(decision, reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
}

let input = '';
for await (const chunk of process.stdin) input += chunk;
const command = JSON.parse(input).tool_input?.command ?? '';

// Most commands are not commits, and the tree is only worth computing for those that are.
// Claude Code runs the command anyway when a hook crashes, so a commit fails closed instead.
let result;
try {
  const { commits } = classifyGitCommand(command);
  const changed = commits ? changedSinceGate(ROOT) : [];
  const tdd = commits ? tddContext(ROOT) : undefined;
  result = decideGitCommand(command, changed, tdd);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  result = { decision: 'deny', reason: `The git guard failed, so this is refused: ${message}` };
}
// An `allow` here would also skip the user's permission settings, so it stays silent.
if (result.decision !== 'allow') answer(result.decision, result.reason);

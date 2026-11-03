// PreToolUse hook for shell commands. The rules live in tools/gates/git-guard.mjs, with their tests.
import { join } from 'node:path';
import {
  changedSinceGate,
  classifyGitCommand,
  decideGitCommand,
} from '../../tools/gates/git-guard.mjs';

const ROOT = join(import.meta.dirname, '..', '..');

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
const changed = classifyGitCommand(command).commits ? changedSinceGate(ROOT) : [];
const { decision, reason } = decideGitCommand(command, changed);
// An `allow` here would also skip the user's permission settings, so it stays silent.
if (decision !== 'allow') answer(decision, reason);

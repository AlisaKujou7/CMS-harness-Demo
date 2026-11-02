# Contributing

The full rules are in [08-GIT-WORKFLOW](AIAGENT_POC/08-GIT-WORKFLOW.md) and
[06-TEST-STRATEGY](AIAGENT_POC/06-TEST-STRATEGY.md). This is the short version.

1. Branch from `main` as `feature/<scope>-<short>`, `fix/<scope>-<short>` or
   `chore/<scope>-<short>`.
2. Follow red, green, refactor. No production code without a failing test that requires it.
3. Run `pnpm gate:fast` before pushing and `pnpm gate` before asking for review.
4. Open a PR with a Conventional Commit title. It becomes the squashed commit message.
5. Merge when every gate is green and one reviewer has approved. The author merges.

## Where the code goes

| The code is...                                   | It belongs in                       |
| ------------------------------------------------ | ----------------------------------- |
| A business rule, regardless of how it is invoked | `modules/<name>/domain/`            |
| Orchestration across ports                       | `modules/<name>/application/`       |
| Talking to a framework or an external system     | `modules/<name>/adapters/`          |
| A presentational component (props only)          | `features/<name>/components/`       |
| A component that reads state                     | `features/<name>/**/*Container.tsx` |
| A timer or cross-cutting flow                    | `features/<name>/streams/`          |

These rules are enforced. If a rule is wrong, change it through an ADR rather than working around
it in a PR.

## Changing a gate

Add a scenario to `tools/gates/self-test.mjs` for every new rule, and run `pnpm gate:self-test`.

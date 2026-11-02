## What

One-paragraph summary of the change.

## Why

Link to the issue or requirement (FR-ID from 02-SRS where applicable).

## How

Brief description of the approach. Mention any architectural decisions.

## Test plan

- [ ] Unit tests added or updated
- [ ] Integration tests added or updated
- [ ] E2E test added or updated (if a user flow is affected)
- [ ] Manual verification steps:

## Risk

- Blast radius (which modules)
- Migration or data impact
- Rollback plan if relevant

## Screenshots or recordings

(for UI changes)

## Checklist

- [ ] Title is a Conventional Commit
- [ ] PR is under 400 LOC of production code (or a split is planned)
- [ ] Tests follow TDD (a test exists for every behavior change)
- [ ] No `any` or `@ts-ignore` without justification
- [ ] OpenAPI spec updated (if the API changed)
- [ ] Docs and runbooks updated (if operations changed)
- [ ] Feature flag added (if the work is incomplete)
- [ ] Linked issue: CMS-\_\_\_

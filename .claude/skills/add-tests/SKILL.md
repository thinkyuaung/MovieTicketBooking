---
name: add-tests
description: Write tests for a movieTicket file in the right place and style, then run them. Invoke with /add-tests <filepath>.
argument-hint: <filepath>
disable-model-invocation: true
---

## File to Test

!`cat $ARGUMENTS`

## File Path

**$ARGUMENTS**

## Task

Write tests for the file above, then run them and report the results.

Pick the right kind of test from the file's location:

| File                                     | Test                                                                        | Where                          | Run                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `backend/src/domain/*.ts`                | Vitest unit tests (pure functions, fixed UTC dates)                         | next to it: `*.test.ts`        | `npx vitest run <file>` in `backend/`    |
| `backend/src/routes/*` or `services/*`   | API tests with Supertest: success + every rule failure (status and message) | `backend/test/api.int.test.ts` | `npm run test` in `backend/`             |
| `frontend/src/lib/*.ts`                  | Vitest unit tests                                                           | next to it: `*.test.ts`        | `npm run test` in `frontend/`            |
| `frontend/src/pages/*` or `components/*` | Playwright end-to-end specs                                                 | `tests/movieticketbookings/`   | `npx playwright test <spec>` at the root |

Rules:

- One behaviour per test; names describe it in plain words.
- Cover the happy path, edge cases and every error the code can throw.
- Playwright: follow `.claude/rules/playwright-conventions.md` and `.claude/rules/validation.md`.
- Test files follow the project rules too (JSDoc on helper functions, `I`-prefixed interfaces).
- Fix failing **tests** only. If a failure shows a real bug in the app, don't change the app: list it under **Bugs found**.

Finish with: tests added, passed/failed, bugs found.

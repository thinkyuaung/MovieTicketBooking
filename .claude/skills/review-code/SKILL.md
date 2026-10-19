---
name: review-code
description: Review a TypeScript file of movieTicket for bugs, project-rule violations and improvements. Invoke with /review-code <filepath>.
argument-hint: <filepath>
disable-model-invocation: true
---

## File to Review

!`cat $ARGUMENTS`

## File Path

**$ARGUMENTS**

## Task

Review the code above. Read related files if needed (callers, types, tests). Report:

1. **Bugs**: logic errors, missing edge cases, unhandled errors, race conditions.
2. **Project rules** (CLAUDE.md and `.claude/rules/`):
   - Interfaces start with `I`; every function has JSDoc; ESM only; async over sync.
   - Backend imports end in `.js`; frontend imports have no extension.
   - Business logic in `domain/` as pure functions; routes only validate, call services and respond.
   - Money in whole kyat, shown with `formatMMK` (`15,000 MMK`); times stored in UTC.
   - Errors thrown with `AppError` helpers; settings read through `config`.
   - Frontend: seats never `disabled`; confirmations inline, never `confirm()`.
3. **Style**: naming, readability, dead code.
4. **Improvements**: performance, missing tests, simpler approaches.

Keep feedback concise. Use bullet points with `file:line`. Mark each finding **High**, **Medium** or **Low**. Don't change code unless the user asks.

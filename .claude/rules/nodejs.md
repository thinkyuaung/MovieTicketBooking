---
paths:
  - "**/package.json"
  - "**/*.js"
  - "**/*.ts"
---

# Node.js Rules

- Use ESM (`import`/`export`) instead of CommonJS (`require`/`module.exports`) unless specified otherwise.
- Always use async, non-blocking methods (`async`/`await`) over sync ones (e.g., `fs.promises.readFile` instead of `fs.readFileSync`).

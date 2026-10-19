---
paths: ["tests/**", "playwright.config.ts"]
---

# Playwright conventions

- Locate elements by `data-testid` when one exists, else by `id` (`#reg-email`), else `getByRole` with its accessible name. Never by CSS class or DOM position. Classes are only for asserting state (`is-selected`, `notice-error`).
- The app has no `data-testid`s and tests never change app code. Ask before adding any.
- Seats: `seat(page, "A3")` from `tests/helpers.ts`. Set up data through the API helpers (`registerUser`, `apiBook`, `findShowWithSeats`), not hard-coded ids.
- One behaviour per test. Names describe it in plain words: `test("refuses an 11th seat with an info message")`.
- Each spec runs `freshStart(page)` in `beforeEach` (open `/`, clear localStorage, reload).
- Screenshots: `shot(page, "NN-kebab-name")` saves `screenshots/NN-name.png` (e.g. `01-home.png`). Numbers stay unique across the suite.
- Never `page.waitForTimeout`. Use web-first `expect(...)` assertions; control the 5-second seat refresh with `page.clock`.
- Tests run serially on the seeded `movieTicket_e2e` database (global setup re-seeds it). Never point them at the dev database.

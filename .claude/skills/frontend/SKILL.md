---
name: frontend
description: How to change the movieTicket frontend (React 19 + Vite + React Router 8 in frontend/). Use when adding or changing a page, a component, the seat plan, API calls from the UI, styles, or frontend tests.
---

# movieTicket frontend

Work inside `frontend/`. The dev server (`npm run dev`, :5173) proxies `/api` to the backend on :3000, so the backend must be running to see real data.

## Building blocks to reuse

| Need | Use | Not |
|---|---|---|
| Load data | `const x = useApi<IThing[]>("/path")` from `lib/useApi` → `data`, `error`, `loading`, `reload()` | `useEffect` + `fetch` |
| Write data | `await api("/path", { method: "POST", body })` from `lib/api`, then `reload()` | raw `fetch` |
| Query strings | `query({ from, hallId })` from `lib/api` | string concatenation |
| Error text | `errorMessage(err)`; check `err instanceof ApiError` for `status` / `details` (e.g. taken seats on 409) | `String(err)` |
| Loading / error UI | `<LoadState loading={x.loading && !x.data} error={x.error} />`, `<Notice tone="ok" \| "error">` | custom spinners |
| Login state | `useAuth()` from `lib/auth`; guard routes with `<RequireAuth>` / `<RequireAuth admin>` | reading the token yourself |
| Money | `formatMMK(15000)` → `15,000 MMK` | `toLocaleString` |
| Dates | `formatDateTime` etc. from `lib/dates` (always Asia/Yangon); `toInputValue` / `fromInputValue` for `datetime-local` | `toLocaleString()` without a time zone |
| Response types | `lib/types.ts` (must match the backend service output) | inline `any` |
| Seats | `components/SeatPlan.tsx` (shared by seat picker, admin showing view, hall editor) | a second seat grid |

## Adding a page: checklist

1. Create `src/pages/<Name>Page.tsx` (admin: `src/pages/admin/`). Export a named function component with JSDoc (`@returns The … page.`). Wrap content in `<section className="page">` with one `<h1>`.
2. Add the `<Route>` in `src/App.tsx`. Logged-in pages are wrapped in `<RequireAuth>`. Admin pages are child routes of `/admin` (under `AdminLayout`, which already guards admins).
3. If the API shape is new, add an `I…` interface to `lib/types.ts` that matches the backend exactly.
4. Add a nav link in `App.tsx` or `AdminLayout.tsx` if users need to reach it.
5. Style it in `src/styles.css` (the only stylesheet).

## UI rules

- **Confirmations are inline**: a "Delete" button switches to "Confirm / Cancel" buttons through state (see `confirmDelete` in `pages/admin/MoviesAdminPage.tsx`). Never `confirm()` or `alert()`.
- **Forms**: keep `busy` state, disable the submit button while saving and change its text (`"Saving…"`), and show the API error in a `<Notice tone="error">`.
- **Seats are never `disabled`**: browsers send no hover events to disabled buttons, and hover shows label, type and price. Use `aria-disabled` and ignore the click.
- **Colours** are CSS variables in `styles.css` with a dark-mode block. Add new colours to both. The chart colour `--chart` is separate from the red accent.
- **Phones**: the seat plan must scroll and zoom. Check new layouts at narrow widths.
- The seat picker refreshes seat status every few seconds. The "Book entire hall" button appears only when the API says the whole-hall rule passes; don't re-implement that rule in the UI.

## Code style

- Import from `react-router` (not `react-router-dom`). Imports have no file extension.
- Interfaces start with `I`. Every function and component has JSDoc.
- Logic worth testing (formatting, grouping, sorting) goes in `src/lib/` as plain functions with a `*.test.ts` next to it, like `lib/money.test.ts`.

## Verify before finishing

```bash
npm run typecheck
npm run test
npm run build      # type-check + production build
```

For visual changes, run the app (backend `npm run dev` + frontend `npm run dev`) and check the page in the browser, in both light and dark mode. Sample logins are in `README.md`.

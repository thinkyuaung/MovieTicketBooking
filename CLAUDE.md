# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**movieTicket**: a cinema ticket booking app. Users browse movies, read reviews, pick specific seats on a cinema-style seat plan and book them. Admins manage movies, halls and showtimes and see a dashboard.

**Tech stack:** Node.js, TypeScript (ESM)

| Part     | Folder                       | Stack                                                                                                 |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend  | `backend/`                   | Express 5, TypeScript, Prisma 6, zod, JWT (jsonwebtoken + bcryptjs), Vitest + Supertest, run with tsx |
| Frontend | `frontend/`                  | React 19, Vite 6, TypeScript, React Router 8 (import from `react-router`), Vitest                     |
| Database | `backend/docker-compose.yml` | MySQL 8.4, schema `movieTicket`                                                                       |

Setup steps and sample logins: `README.md`.

## Commands

Run inside `backend/` or `frontend/`:

- Build: `npm run build`
- Test: `npm run test`
- Dev server: `npm run dev` (backend :3000, frontend :5173 proxies `/api` to the backend)
- Type-check: `npm run typecheck`
- Tests: npx playwright test; follow .claude/rules/
- Database (backend only): `npm run db:up` / `db:down`, `npm run migrate`, `npm run seed` (seed deletes all data first), `npm run prisma:generate` after editing the schema without migrating, `npm run export [-- table…]` (tables to `backend/exports/*.json`, no password hashes)
- Single test file: `npx vitest run src/domain/booking.test.ts` (add `-t "name"` for one test)
- Production (backend): `npm run build` then `npm run start` (runs `dist/server.js`); apply migrations with `npm run migrate:deploy`

## Environment (backend)

`backend/.env` (copy from `.env.example`), loaded by `src/config.ts` with `process.loadEnvFile()`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `TEST_DATABASE_URL`. Always read settings through `config`, not `process.env`. `src/db.ts` exports the shared `prisma` client.

## MCP servers

Configured in `.mcp.json`, installed as root dev dependencies (run `npm install` at the root). Check with `/mcp`.

- `playwright`: drive a real browser against the running app (`http://localhost:5173`) to check UI changes or debug e2e failures. Durable checks still belong in `tests/` as Playwright specs.
- `mysql`: read-only queries (`mysql_query`) as `mcp_readonly` (SELECT only on `movieticket`, `movieticket_e2e`, `movieticket_test`; writes also blocked by the server). Prefix tables with the database, e.g. `movieticket.bookings`.
- `github`: GitHub's hosted server for `thinkyuaung/MovieTicketBooking`, authenticated with a personal access token.
- Secrets: `.mcp.json` reads `${MCP_MYSQL_PASSWORD}` and `${GITHUB_TOKEN}` from real environment variables (Windows user variables), not from the `env` block of settings files, which is applied too late. After changing one, restart VS Code completely.

## Testing (backend)

- Unit tests sit next to the code (`src/**/*.test.ts`). API tests are in `test/api.int.test.ts` and run against a real MySQL. Test files run one at a time (`fileParallelism: false`) because they share one database.
- API tests use `TEST_DATABASE_URL` (`movieTicket_test`), never `DATABASE_URL`, and delete all data on every run. Under Vitest, `config.databaseUrl` always returns the test URL. `test/globalSetup.ts` applies migrations and skips the API tests if the test database is unreachable or its name doesn't contain "test".
- Add an API test for every new endpoint and every business-rule failure (status code and message).

## Code Layout

- `backend/src/app.ts`: `createApp()` builds the Express app (used by tests) and the central error handler; `server.ts` starts it.
- `backend/src/routes/`: thin route modules mounted under `/api`. Request validation with zod lives in `routes/schemas.ts`.
- `backend/src/services/`: database work with Prisma (`bookingService`, `movieService`, `seatPlanService`, `catalogService` for admin CRUD, `dashboardService`, `reviewService`, `authService`). `showtimeStats.ts` loads seat counts and revenue for many showings in a few grouped queries. `mappers.ts` converts Prisma rows to domain types (`toMovie`, `movieInclude`…).
- `backend/src/domain/`: pure business logic with tests next to it: `booking.ts` (seat and whole-hall rules), `seatPlan.ts`, `showtime.ts` (end time, overlap), `cinema.ts` (movie view, admin dashboard), `pricing.ts`, `money.ts`, `hallLayout.ts`, `bookingCode.ts`, `movie.ts`.
- `backend/src/auth/`: bcrypt passwords, JWT tokens, `requireAuth` / `requireAdmin` middleware. The logged-in user is read with `currentUser(res)`.
- `backend/src/errors.ts`: `AppError` and helpers (`badRequest`, `notFound`, `conflict`…). Throw these; the error handler turns them into `{ error, details? }` JSON.
- `backend/prisma/schema.prisma`: database schema; `prisma/seed.ts`: sample data.
- `frontend/src/lib/`: `api.ts` (`api<T>(path, {method, body})` adds the saved login token; errors are `ApiError` with `status` and `details`), `auth.tsx` (`AuthProvider` / `useAuth`), `useApi.ts` (load + `reload`), `dates.ts` (always formats in Asia/Yangon; `toInputValue` / `fromInputValue` for `datetime-local` inputs), `money.ts` (`formatMMK`), `types.ts` (API response shapes; keep in sync with backend services).
- `frontend/src/components/SeatPlan.tsx`: the cinema seat plan, shared by the customer seat picker, the admin showing view (tooltip shows who booked) and the hall editor. Seats are never `disabled` (browsers send no hover events to disabled buttons); non-clickable seats use `aria-disabled`.
- `frontend/src/components/common.tsx`: shared UI bits (`Notice`, `LoadState`, `Score`, `AgeBadge`, `Poster`) and the `RequireAuth` route guard (`admin` prop for admin-only).
- `frontend/src/App.tsx`: all routes: `/`, `/movies/:id`, `/showtimes/:id` (seat picker), `/login`, `/register`, `/bookings`, `/bookings/:id`, `/admin` (dashboard), `/admin/showtimes[/:id]`, `/admin/movies`, `/admin/halls[/:id]`.
- `frontend/src/pages/`: customer pages; `pages/admin/`: admin pages under `AdminLayout` (admins only). Confirmations are inline buttons, never `confirm()`.
- `frontend/src/styles.css`: one stylesheet; colours are CSS variables with a dark-mode block. Chart colour `--chart` is separate from the red accent.
- Root `app.js` and `src/` (`cinema.ts`, `movie.ts`) are leftover starter files, not part of the app. The real code is in `backend/` and `frontend/`; don't edit or import from them.

## Conventions

- Backend imports use `.js` extensions (NodeNext); frontend imports have no extension (Bundler).
- From `.claude/rules/`: prefix interfaces with `I` (`IMovie`), give every function a JSDoc comment, use ESM only, and prefer async APIs over sync ones.
- Keep logic in `domain/` as pure functions and test it there; routes only validate input, call Prisma and domain functions, and shape the response.
- `backend/src/domain/money.ts` and `frontend/src/lib/money.ts` must produce the same format.
- Times are stored in UTC. Myanmar Time is UTC+06:30; convert only for display and seed data.
- npm blocks package install scripts by default; approved ones are listed under `allowScripts` in each `package.json`.

## Database

Full ER diagram, constraints and indexes: `docs/er-diagram.md`. Keep it in sync with `backend/prisma/schema.prisma`. After changing the schema, run `npm run migrate` to create a new migration.

Tables: `users`, `movies`, `genres`, `movie_genres`, `halls`, `seats`, `showtimes`, `bookings`, `booking_seats`, `reviews`.

## Business Rules

- **Currency is MMK.** Store prices as whole kyat (`INT UNSIGNED`, no decimals). Display as `15,000 MMK` with `formatMMK`.
- **Seat selection:** users choose specific seats (A1, A2…). Seat labels skip aisles (A1–A6, aisle, A7–A12). Halls are built with `generateHall()` from a row description.
- **Seat types and price** (`seatPrice()`): `standard` and `wheelchair` use `price_standard`, `vip` uses `price_vip`, `couple` uses `price_couple` (one seat record, width 2, priced per pair). Each `booking_seats` row stores the price paid.
- **No double-booking:** enforced by `UNIQUE(showtime_id, seat_id)` on `booking_seats`. On cancel, set `booking_seats.showtime_id` to `NULL` to free the seat and keep history.
- **Normal booking:** 1 to 10 seats, all in the showtime's hall and `is_active = true`. Return 409 if a seat is already taken.
- **Whole-hall booking:** allowed only when the show starts **at least 7 days from now** (else 400) AND the showing has **no confirmed bookings** (else 409). Price is `fullHallPrice()`: `full_hall_price` if set, otherwise the sum of all seat prices. Save with `is_full_hall = true`.
- **Concurrency:** every booking (seats or whole hall) runs in a READ COMMITTED transaction that first locks the showtime row with `SELECT … FOR UPDATE`, so bookings for one showing are handled one at a time. The unique key on `booking_seats` is the final guard (P2002 → 409).
- **Cancelling a showing** (admin) cancels all its confirmed bookings and frees the seats. Showings with any bookings can't be deleted, only cancelled. Movie, hall and time can't change once a showing has bookings; prices can.
- **Halls:** the layout can only be replaced while the hall has no showings. After that, admins switch single seats off (`is_active = false`). Seats can't change to or from `couple`.
- Showtimes in the same hall must not overlap.
- One review per user per movie, score 1–10.
- Cancelling is only allowed before the show starts.

## Seat Plan (frontend)

Looks like a real cinema: screen at the top, row letters on both sides, aisles and gaps from the hall layout grid (`grid_row`, `grid_col`, `width`). Seat states: available, selected, taken, VIP, couple, wheelchair. Hover shows label, type and price. Summary panel shows chosen seats and total in MMK. Show the "Book entire hall" button only when the whole-hall rule passes. Refresh seat status every few seconds. Must scroll and zoom on phones.

## API

Logged-in routes need `Authorization: Bearer <token>` (token from register or login, valid 7 days). Errors are `{ "error": "message", "details"?: … }`.

Public: `GET /api/movies?q=&genre=`, `GET /api/movies/genres`, `GET /api/movies/:id`, `GET /api/showtimes/:id/seats`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/health`, `GET /api/health/db`.

Logged in: `GET /api/auth/me`, `POST /api/bookings` `{showtimeId, seats: ["A1"]}`, `POST /api/showtimes/:id/book-all`, `GET /api/bookings/me`, `GET /api/bookings/:id`, `DELETE /api/bookings/:id` (cancel), `POST /api/movies/:id/reviews` `{score, comment}`.

Admin (role `admin` only):

- `GET /api/admin/dashboard?from=&to=` (range filters showings by start time)
- Movies: `GET`, `POST /api/admin/movies`, `PATCH`, `DELETE /api/admin/movies/:id`
- Halls: `GET /api/admin/halls`, `GET /api/admin/halls/:id` (with seats), `POST` `{name, rows}`, `POST /preview` `{rows}` (layout without saving), `PATCH /:id` `{name}`, `PUT /:id/layout` `{rows}`, `PATCH /:id/seats/:seatId` `{isActive?, type?}`, `DELETE /:id`
- Showtimes: `GET /api/admin/showtimes?from=&to=&movieId=&hallId=`, `GET /:id`, `GET /:id/bookings` (who booked), `POST`, `PATCH /:id`, `POST /:id/cancel`, `DELETE /:id`
- `DELETE /api/admin/reviews/:id`

## Plan

1. **Setup** ✅ done: folders, configs, Docker MySQL, Prisma schema + first migration, seed data, domain helpers and tests, frontend shell.
2. **User API** ✅ done: movies, seat plan, seat booking, whole-hall booking, cancelling, reviews, auth.
3. **Admin API** ✅ done: dashboard (revenue in MMK, how full each showing is, whole-hall bookings, low reviews), movie/hall/seat/showtime management, bookings per showing, review removal.
4. **Frontend** ✅ done: movie list (search, genre), movie detail (showtimes by day, reviews), seat picker (live refresh, whole-hall option), ticket page, my bookings, login/register, admin dashboard, showtimes, movies, halls with layout editor and seat switch-off.
5. **Tests:** frontend tests (only `src/lib/money.test.ts` exists so far). (Backend API tests for booking conflicts, same-seat race, whole-hall rule, MMK totals and admin protection are already in `test/api.int.test.ts`.)
6. **Finish:** rate limiting on login, production settings (strong `JWT_SECRET`, non-root DB user), README polish.

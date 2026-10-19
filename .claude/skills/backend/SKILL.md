---
name: backend
description: How to change the movieTicket backend (Express 5 + Prisma + MySQL in backend/). Use when adding or changing an API endpoint, a business rule, a service, a zod schema, the Prisma schema or a migration, or backend tests.
---

# movieTicket backend

Work inside `backend/`. Read the Business Rules and API sections of `CLAUDE.md` before changing behaviour.

## Where code goes

A request passes through these layers. Put each piece of work in the right one:

| Layer | File | Does | Never |
|---|---|---|---|
| Schema | `src/routes/schemas.ts` | zod shape of params, query and body, with user-facing messages | talk to the database |
| Route | `src/routes/<area>.ts` | `schema.parse(...)`, call one service, `res.json` / `res.status(201).json` / `res.status(204).end()` | contain business rules or Prisma calls |
| Service | `src/services/<area>Service.ts` | Prisma queries and transactions, throw `AppError` helpers | contain rules that can be pure |
| Domain | `src/domain/<topic>.ts` | pure functions for rules and calculations, no I/O | import Prisma or Express |
| Mapper | `src/services/mappers.ts` | Prisma row → domain/response type (`toMovie`, `toReview`…) | — |

Mounting is in `src/app.ts` (`/api/movies`, `/api/showtimes`, `/api/bookings`, `/api/auth`, `/api/admin`, `/api/health`). New admin routes go in `src/routes/admin.ts`, which already runs `adminRouter.use(requireAdmin)`. For a logged-in route, add `requireAuth` and read the user with `currentUser(res)`.

## Adding an endpoint: checklist

1. **Schema** in `routes/schemas.ts`. Reuse `idParam`, `mmk`, `dateRangeQuery`. Write messages for users (`"Choose at least one seat."`).
2. **Domain rule** (if any) as a pure function in `domain/`, with a test next to it (`*.test.ts`, plain `describe/it/expect`, fixed UTC dates like `new Date("2026-10-20T13:00:00Z")`).
3. **Service** function: JSDoc with `@param`, `@returns` and `@throws AppError 404/409…`. Throw `notFound("Movie")`, `badRequest(...)`, `conflict(msg, details)`, `forbidden(...)` from `src/errors.ts`. Map Prisma `P2002` to a specific `conflict(...)` when the generic "This already exists." isn't clear enough.
4. **Route**: keep it to parsing, calling the service and responding (see `routes/movies.ts`).
5. **API test** in `test/api.int.test.ts`: the success case plus every rule failure, asserting both status and `body.error`. Use `request(app)` with `.set(auth(tokens.aung))`. Put it in the matching `describe` block.
6. **Docs**: add the endpoint to the API section of `CLAUDE.md`. If the response shape changed, update `frontend/src/lib/types.ts`.

## Rules that are easy to break

- **Bookings** (seats or whole hall) run in a READ COMMITTED `prisma.$transaction` that first does `SELECT … FOR UPDATE` on the showtime row. Keep that order in any new booking-like write. The `UNIQUE(showtime_id, seat_id)` key is the final guard (P2002 → 409).
- **Cancelling** frees seats by setting `booking_seats.showtime_id = NULL`. Never delete booking rows.
- **Money** is whole kyat integers. No floats, no decimals. Format only with `formatMMK` from `domain/money.ts`, which must stay identical to `frontend/src/lib/money.ts`.
- **Time** is stored and compared in UTC. Convert to Myanmar Time (UTC+06:30) only for display and seed data.
- **Settings** come from `config` (`src/config.ts`), never `process.env` directly. Use the shared `prisma` from `src/db.ts`; never create another `PrismaClient`.
- Imports end in `.js` (`../errors.js`). Interfaces start with `I`. Every function has JSDoc.

## Changing the database

1. Edit `prisma/schema.prisma` (snake_case table/column names via `@@map` / `@map`, like the existing models).
2. `npm run migrate -- --name <short_name>` creates the migration and regenerates the client.
3. Update `docs/er-diagram.md`, `prisma/seed.ts` if sample data needs the new field, and `resetDatabase()` in `test/api.int.test.ts` if you added a table (delete children before parents).

## Verify before finishing

```bash
npm run typecheck
npm run test                                 # unit + API tests (API tests need `npm run db:up`)
npx vitest run src/domain/booking.test.ts    # a single file
```

If the API tests show as skipped, the test database isn't reachable. Say so instead of reporting them as passed. Never point tests at `DATABASE_URL`: they wipe every table.

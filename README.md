# movieTicket

Cinema ticket booking app: browse movies, read reviews, pick seats on a cinema-style seat plan, book them, and manage everything from an admin dashboard. Prices are in MMK.

| Folder | What |
|---|---|
| `backend/` | Express + TypeScript API, Prisma, MySQL 8 (`movieTicket`) |
| `frontend/` | React + Vite + TypeScript |
| `docs/er-diagram.md` | Database ER diagram and rules |

## Requirements

- Node.js 22 or newer
- Docker Desktop (for MySQL), or your own MySQL 8 server

## First-time setup

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # edit DATABASE_URL if you use your own MySQL
npm run db:up               # starts MySQL 8 in Docker with database movieTicket
npm run migrate             # creates the tables
npm run seed                # sample movies, halls, showtimes, bookings, reviews
npm run dev                 # API on http://localhost:3000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # app on http://localhost:5173 (calls the API through /api)
```

Sample logins after seeding:

| Role | Email | Password |
|---|---|---|
| Admin | admin@movieticket.local | admin123 |
| User | aung@example.com | password123 |

## Commands

Run inside `backend/` or `frontend/`.

| Command | Does |
|---|---|
| `npm run dev` | Start in watch mode |
| `npm run build` | Type-check and build to `dist/` |
| `npm run test` | Run tests (Vitest) |
| `npm run typecheck` | Type-check only |
| `npm run migrate` | Backend: apply schema changes to MySQL (creates a new migration if the schema changed) |
| `npm run seed` | Backend: **deletes all data** and loads sample data |
| `npm run db:up` / `db:down` | Backend: start / stop the MySQL container |

## Tests

`npm run test` in `backend/` runs unit tests and API tests. The API tests use a separate database set by `TEST_DATABASE_URL` in `.env` (default `movieTicket_test`), which is created automatically and **wiped on every run**. If that database can't be reached, the API tests are skipped and the unit tests still run.

## Check it's working

- http://localhost:3000/api/health → `{"status":"ok"}`
- http://localhost:3000/api/health/db → `{"status":"ok","database":"connected"}`
- The frontend home page shows both as green.

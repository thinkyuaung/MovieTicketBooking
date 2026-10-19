/**
 * Exports database tables to JSON files in `backend/exports/<table>.json`.
 *
 * Usage (in backend/):
 *   npm run export              all tables
 *   npm run export -- bookings  one or more tables, e.g. `-- bookings users`
 *
 * Rows are written flat, exactly as stored (times in UTC, prices in whole kyat).
 * `users.password_hash` is never exported.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/db.js";

/** Where the JSON files go. */
const EXPORT_DIR = path.join(import.meta.dirname, "..", "exports");

/** Loads every row of one table. */
type IRowLoader = () => Promise<unknown[]>;

/** Export loaders by table name (the MySQL table names). */
const TABLES: Record<string, IRowLoader> = {
  users: () => prisma.user.findMany({ omit: { passwordHash: true } }),
  movies: () => prisma.movie.findMany(),
  genres: () => prisma.genre.findMany(),
  movie_genres: () => prisma.movieGenre.findMany(),
  halls: () => prisma.hall.findMany(),
  seats: () => prisma.seat.findMany(),
  showtimes: () => prisma.showtime.findMany(),
  bookings: () => prisma.booking.findMany(),
  booking_seats: () => prisma.bookingSeat.findMany(),
  reviews: () => prisma.review.findMany(),
};

/**
 * Returns the tables to export from the command-line arguments.
 *
 * @param args - Table names given after `--`; empty means all tables.
 * @returns Table names to export.
 * @throws If a name is not a known table.
 */
function chooseTables(args: string[]): string[] {
  if (args.length === 0) return Object.keys(TABLES);
  const unknown = args.filter((name) => !(name in TABLES));
  if (unknown.length) {
    throw new Error(`Unknown table(s): ${unknown.join(", ")}. Choose from: ${Object.keys(TABLES).join(", ")}.`);
  }
  return args;
}

/**
 * Writes each chosen table to its own JSON file and prints a summary.
 */
async function main(): Promise<void> {
  const tables = chooseTables(process.argv.slice(2));
  await mkdir(EXPORT_DIR, { recursive: true });
  for (const table of tables) {
    const rows = await TABLES[table]();
    const file = path.join(EXPORT_DIR, `${table}.json`);
    await writeFile(file, JSON.stringify(rows, null, 2) + "\n");
    console.log(`${table.padEnd(14)} ${String(rows.length).padStart(5)} rows → ${path.relative(process.cwd(), file)}`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

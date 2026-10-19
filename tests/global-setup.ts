import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(exec);

/**
 * Migrates and re-seeds the e2e database before the test run, so every run
 * starts from the same sample data (movies, halls, 14 days of showtimes, users).
 * Refuses to touch a database whose name doesn't mark it as a test database.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is not set (see playwright.config.ts).");
  const dbName = new URL(url).pathname.slice(1);
  if (!/e2e|test/i.test(dbName)) throw new Error(`Refusing to seed "${dbName}": not an e2e/test database.`);

  const options = { cwd: path.join(process.cwd(), "backend"), env: { ...process.env, DATABASE_URL: url } };
  await run("npx prisma migrate deploy", options);
  await run("npx prisma db seed", options);
}

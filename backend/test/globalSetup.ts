import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { TestProject } from "vitest/node";

const run = promisify(exec);

declare module "vitest" {
  export interface ProvidedContext {
    /** True when the test database is reachable and migrated. */
    dbReady: boolean;
  }
}

/**
 * Prepares the test database before any test runs. Integration tests are
 * skipped (not failed) when TEST_DATABASE_URL is missing or unreachable.
 *
 * @param project - The Vitest project, used to pass `dbReady` to tests.
 */
export default async function setup(project: TestProject): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file.
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/test/i.test(new URL(url).pathname) || url === process.env.DATABASE_URL) {
    console.warn("Integration tests skipped: set TEST_DATABASE_URL to a separate database whose name contains 'test'.");
    project.provide("dbReady", false);
    return;
  }
  try {
    await run("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url } });
    project.provide("dbReady", true);
  } catch (err) {
    console.warn(`Integration tests skipped: test database unreachable.\n${(err as Error).message.split("\n")[0]}`);
    project.provide("dbReady", false);
  }
}

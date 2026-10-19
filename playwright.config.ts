import { defineConfig, devices } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * Works out the database the e2e backend uses. Defaults to `movieTicket_e2e` on
 * the same MySQL server as `backend/.env`, so the dev database is never touched
 * (global setup wipes and re-seeds it). Override with `E2E_DATABASE_URL`.
 *
 * @returns The e2e database URL.
 */
async function e2eDatabaseUrl(): Promise<string> {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const env = parseEnv(await readFile(path.join(process.cwd(), "backend", ".env"), "utf8"));
  if (!env.DATABASE_URL) throw new Error("Set DATABASE_URL in backend/.env or E2E_DATABASE_URL.");
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/movieTicket_e2e";
  return url.toString();
}

process.env.E2E_DATABASE_URL = await e2eDatabaseUrl();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  // Tests share one seeded database and book real seats, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // The UI runs on Vite (:5173), which proxies /api to the backend (:3000).
    baseURL: "http://localhost:5173",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: "backend",
      url: "http://localhost:3000/api/health",
      env: { DATABASE_URL: process.env.E2E_DATABASE_URL },
      // Never reuse a running dev backend: it would point at the dev database.
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --strictPort",
      cwd: "frontend",
      url: "http://localhost:5173",
      // The frontend holds no data, so a running dev server is fine to reuse.
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});

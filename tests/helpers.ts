import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/** Folder for named screenshots taken with {@link shot}. */
const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");

/** Seeded logins (see backend/prisma/seed.ts). */
export const ADMIN = { email: "admin@movieticket.local", password: "admin123" };
export const AUNG = { email: "aung@example.com", password: "password123", name: "Aung Aung" };

/**
 * Seat type as the API returns it.
 */
export type SeatType = "standard" | "vip" | "couple" | "wheelchair";

/**
 * One seat in a showtime's seat plan.
 */
export interface IPlanSeat {
  label: string;
  type: SeatType;
  price?: number;
  status: "available" | "taken" | "unavailable";
}

/**
 * The parts of `GET /api/showtimes/:id/seats` the tests use.
 */
export interface ISeatPlan {
  showtime: { id: number; startsAt: string; hall: { name: string }; movie: { id: number; title: string } };
  plan: {
    seats: IPlanSeat[];
    counts: { total: number; available: number; taken: number };
    fullHall: { eligible: boolean; reason: string | null; price: number };
  };
}

/**
 * A freshly registered test user.
 */
export interface ITestUser {
  name: string;
  email: string;
  password: string;
  token: string;
}

/**
 * Saves a full-page screenshot to `screenshots/<name>.png`.
 *
 * @param page - The page.
 * @param name - File name without extension, e.g. `01-home`.
 */
export async function shot(page: Page, name: string): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

/**
 * Opens the app with empty localStorage (logged out, nothing remembered).
 *
 * @param page - The page.
 */
export async function freshStart(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/**
 * Logs the browser in by saving a token the way the app does, then reloads.
 *
 * @param page - The page.
 * @param token - A login token from the API.
 * @param url - Page to open afterwards.
 */
export async function loginWithToken(page: Page, token: string, url = "/"): Promise<void> {
  await page.evaluate((t) => localStorage.setItem("mt.token", t), token);
  await page.goto(url);
}

/**
 * Logs in through the API.
 *
 * @param request - Playwright API context.
 * @param creds - Email and password.
 * @returns The login token.
 */
export async function apiLogin(request: APIRequestContext, creds: { email: string; password: string }): Promise<string> {
  const res = await request.post("/api/auth/login", { data: creds });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).token;
}

/**
 * Returns an email address no other test has used.
 *
 * @param prefix - Readable start of the address.
 * @returns e.g. `buyer-1734-ab12@e2e.test`.
 */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

/**
 * Registers a new user through the API.
 *
 * @param request - Playwright API context.
 * @param name - Display name.
 * @returns The user with its password and token.
 */
export async function registerUser(request: APIRequestContext, name = "E2E Buyer"): Promise<ITestUser> {
  const user = { name, email: uniqueEmail("buyer"), password: "password123" };
  const res = await request.post("/api/auth/register", { data: user });
  expect(res.status(), await res.text()).toBe(201);
  return { ...user, token: (await res.json()).token };
}

/**
 * Books seats through the API (test setup, or "someone else" taking a seat).
 *
 * @param request - Playwright API context.
 * @param token - The booking user's token.
 * @param showtimeId - Showtime id.
 * @param seats - Seat labels.
 * @returns The new booking's id and code.
 */
export async function apiBook(
  request: APIRequestContext,
  token: string,
  showtimeId: number,
  seats: string[],
): Promise<{ id: number; bookingCode: string; totalPrice: number }> {
  const res = await request.post("/api/bookings", { data: { showtimeId, seats }, headers: { Authorization: `Bearer ${token}` } });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

/**
 * Loads a showtime's seat plan from the API.
 *
 * @param request - Playwright API context.
 * @param id - Showtime id.
 * @returns The seat plan.
 */
export async function getSeatPlan(request: APIRequestContext, id: number): Promise<ISeatPlan> {
  const res = await request.get(`/api/showtimes/${id}/seats`);
  expect(res.ok()).toBe(true);
  return res.json();
}

/**
 * Finds the first upcoming showing (at least 2 hours away) that matches a test.
 *
 * @param request - Playwright API context.
 * @param match - Returns true for a suitable seat plan.
 * @returns The seat plan of the first match.
 * @throws If no seeded showing matches.
 */
export async function findShowtime(request: APIRequestContext, match: (plan: ISeatPlan) => boolean): Promise<ISeatPlan> {
  const movies: { id: number }[] = await (await request.get("/api/movies")).json();
  const soonest = Date.now() + 2 * 3600_000;
  const shows: { showtimeId: number; startsAt: string }[] = [];
  for (const m of movies) {
    const view = await (await request.get(`/api/movies/${m.id}`)).json();
    shows.push(...view.showtimes.filter((s: { startsAt: string }) => new Date(s.startsAt).getTime() > soonest));
  }
  shows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const s of shows) {
    const plan = await getSeatPlan(request, s.showtimeId);
    if (match(plan)) return plan;
  }
  throw new Error("No seeded showing matches this test. Re-run so global setup re-seeds the e2e database.");
}

/**
 * Returns free seats of the given types from a seat plan.
 *
 * @param plan - The seat plan.
 * @param type - Seat type wanted.
 * @param count - How many seats.
 * @returns Seat records (fewer than `count` if not enough are free).
 */
export function freeSeats(plan: ISeatPlan, type: SeatType, count: number): IPlanSeat[] {
  return plan.plan.seats.filter((s) => s.type === type && s.status === "available").slice(0, count);
}

/**
 * Finds a showing with enough free seats of each type.
 *
 * @param request - Playwright API context.
 * @param need - Seats needed per type, e.g. `{ standard: 2, vip: 1 }`.
 * @param extra - Optional extra condition.
 * @returns The seat plan.
 */
export async function findShowWithSeats(
  request: APIRequestContext,
  need: Partial<Record<SeatType, number>>,
  extra: (plan: ISeatPlan) => boolean = () => true,
): Promise<ISeatPlan> {
  return findShowtime(
    request,
    (p) => extra(p) && Object.entries(need).every(([type, n]) => freeSeats(p, type as SeatType, n!).length === n),
  );
}

/**
 * Locates a seat button on the seat plan by its label.
 *
 * @param page - The page.
 * @param label - Seat label, e.g. `A3`.
 * @returns The seat button.
 */
export function seat(page: Page, label: string): Locator {
  return page.getByRole("group", { name: /^Seat plan for/ }).getByRole("button", { name: new RegExp(`^${label},`) });
}

/**
 * Formats kyat the same way as the app (`15000` → `15,000 MMK`).
 *
 * @param amount - Whole kyat.
 * @returns The formatted amount.
 */
export function mmk(amount: number): string {
  return `${amount.toLocaleString("en-US")} MMK`;
}

/**
 * Returns a `datetime-local` value (Myanmar Time) some days from now at a given hour.
 *
 * @param days - Days from today.
 * @param hour - Hour in Myanmar Time (0–23).
 * @returns e.g. `2026-11-30T09:00`.
 */
export function yangonInput(days: number, hour: number): string {
  // Myanmar Time is UTC+06:30 all year; shift so the UTC fields read as Yangon wall-clock time.
  const yangon = new Date(Date.now() + 6.5 * 3600_000 + days * 86_400_000);
  const date = yangon.toISOString().slice(0, 10);
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}

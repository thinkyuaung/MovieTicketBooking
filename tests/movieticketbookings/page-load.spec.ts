import { expect, test } from "@playwright/test";
import { findShowtime, freshStart, loginWithToken, registerUser, shot } from "../helpers";

const SEEDED_TITLES = ["Inception", "Spirited Away", "Interstellar", "Parasite", "Coco"];

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("page load", () => {
  test("has the movieTicket document title", async ({ page }) => {
    await expect(page).toHaveTitle("movieTicket");
  });

  test("shows the header with brand and guest navigation", async ({ page }) => {
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "movieTicket" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Movies" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "My bookings" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await shot(page, "01-home");
  });

  test("shows the search and genre filter form", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Now showing" })).toBeVisible();
    await expect(page.locator("#movie-search")).toBeEmpty();
    await expect(page.locator("#movie-genre")).toHaveValue("");
    await expect(page.locator("#movie-genre option").first()).toHaveText("All genres");
  });

  test("lists every seeded movie", async ({ page }) => {
    for (const title of SEEDED_TITLES) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.locator(".movie-grid > li")).toHaveCount(SEEDED_TITLES.length);
  });

  test("filters movies by search text", async ({ page }) => {
    await page.locator("#movie-search").fill("coco");
    await expect(page.locator(".movie-grid > li")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Coco" })).toBeVisible();
  });

  test("filters movies by genre", async ({ page }) => {
    await page.locator("#movie-genre").selectOption("Animation");
    await expect(page.getByRole("heading", { level: 2, name: "Spirited Away" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Coco" })).toBeVisible();
    await expect(page.locator(".movie-grid > li")).toHaveCount(2);
  });

  test("shows the empty state when no movie matches", async ({ page }) => {
    await page.locator("#movie-search").fill("no such movie zzz");
    await expect(page.getByText("No movies match your search.")).toBeVisible();
    await expect(page.locator(".movie-grid > li")).toHaveCount(0);
    await shot(page, "02-search-empty-state");
  });

  test("shows an empty booking summary on the seat picker", async ({ page, request }) => {
    const show = await findShowtime(request, () => true);
    await page.goto(`/showtimes/${show.showtime.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Choose your seats" })).toBeVisible();
    const summary = page.locator(".picker-summary");
    await expect(summary.getByRole("heading", { name: "Your booking" })).toBeVisible();
    await expect(summary.getByText("Click seats on the plan to choose them.")).toBeVisible();
    await expect(summary.locator(".total")).toHaveText(/Total\s*0 MMK/);
    await expect(summary.getByRole("button", { name: "Log in to book" })).toBeDisabled();
    await shot(page, "03-seat-picker-empty");
  });

  test("shows the empty state on My bookings for a new user", async ({ page, request }) => {
    const user = await registerUser(request);
    await loginWithToken(page, user.token, "/bookings");
    await expect(page.getByRole("heading", { level: 1, name: "My bookings" })).toBeVisible();
    await expect(page.getByText("You haven't booked anything yet.")).toBeVisible();
    await shot(page, "04-my-bookings-empty");
  });
});

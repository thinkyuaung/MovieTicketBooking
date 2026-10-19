import { expect, test } from "@playwright/test";
import { AUNG, apiBook, findShowWithSeats, freeSeats, freshStart, loginWithToken, registerUser, seat, shot } from "../helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("persistence", () => {
  test("starts logged out after localStorage is cleared", async ({ page, request }) => {
    const user = await registerUser(request);
    await loginWithToken(page, user.token);
    await expect(page.getByRole("banner").getByText(user.name)).toBeVisible();

    await freshStart(page);

    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("keeps the user logged in after a reload", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill(AUNG.email);
    await page.locator("#login-password").fill(AUNG.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("banner").getByText(AUNG.name)).toBeVisible();

    await page.reload();

    await expect(page.getByRole("banner").getByText(AUNG.name)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("mt.token"))).toBeTruthy();
  });

  test("stays logged out after logging out and reloading", async ({ page, request }) => {
    const user = await registerUser(request);
    await loginWithToken(page, user.token);
    await page.getByRole("button", { name: "Log out" }).click();

    await page.reload();

    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Log in" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("mt.token"))).toBeNull();
  });

  test("keeps a booking after a reload", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    const booking = await apiBook(request, user.token, plan.showtime.id, [a.label]);
    await loginWithToken(page, user.token, `/bookings/${booking.id}`);

    await page.reload();

    await expect(page.locator(".ticket .code")).toHaveText(booking.bookingCode);
    await page.goto("/bookings");
    await page.reload();
    await expect(page.locator(".booking-row")).toContainText(a.label);
  });

  test("keeps a guest's chosen seats through the login redirect", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 2 });
    const labels = freeSeats(plan, "standard", 2).map((s) => s.label);
    await page.goto(`/showtimes/${plan.showtime.id}`);
    for (const label of labels) await seat(page, label).click();

    await page.getByRole("button", { name: "Log in to book" }).click();
    await page.locator("#login-email").fill(AUNG.email);
    await page.locator("#login-password").fill(AUNG.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(new RegExp(`/showtimes/${plan.showtime.id}$`));
    for (const label of labels) await expect(seat(page, label)).toHaveClass(/\bis-selected\b/);
    await expect(page.getByRole("button", { name: "Book 2 seats" })).toBeEnabled();
    await shot(page, "22-selection-kept-after-login");
  });

  test("forgets an unbooked selection after a reload", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    await page.goto(`/showtimes/${plan.showtime.id}`);
    await seat(page, a.label).click();
    await expect(seat(page, a.label)).toHaveClass(/\bis-selected\b/);

    await page.reload();

    await expect(seat(page, a.label)).not.toHaveClass(/\bis-selected\b/);
    await expect(page.getByText("Click seats on the plan to choose them.")).toBeVisible();
  });
});

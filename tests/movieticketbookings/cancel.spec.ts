import { expect, test, type Page } from "@playwright/test";
import { apiBook, findShowWithSeats, freeSeats, freshStart, getSeatPlan, loginWithToken, registerUser, seat, shot, type ISeatPlan, type ITestUser } from "../helpers";

/**
 * Cancels the booking on its ticket page through the inline confirmation.
 *
 * @param page - The page, showing the ticket.
 */
async function cancelOnTicket(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.locator(".ticket .stamp")).toContainText("Cancelled");
}

test.describe("cancelling a booking", () => {
  let user: ITestUser;
  let plan: ISeatPlan;
  let labels: string[];
  let bookingId = 0;

  test.beforeEach(async ({ page, request }) => {
    await freshStart(page);
    user = await registerUser(request);
    plan = await findShowWithSeats(request, { standard: 2 });
    labels = freeSeats(plan, "standard", 2).map((s) => s.label);
    bookingId = (await apiBook(request, user.token, plan.showtime.id, labels)).id;
    await loginWithToken(page, user.token, `/bookings/${bookingId}`);
  });

  test("asks for inline confirmation and keeps the booking on Keep booking", async ({ page }) => {
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText(`free all 2 seats?`)).toBeVisible();
    await shot(page, "18-cancel-confirm");

    await page.getByRole("button", { name: "Keep booking" }).click();

    await expect(page.getByRole("button", { name: "Cancel booking" })).toBeVisible();
    await expect(page.locator(".ticket")).not.toHaveClass(/\bis-cancelled\b/);
  });

  test("marks the ticket cancelled and removes the cancel button", async ({ page }) => {
    await cancelOnTicket(page);

    await expect(page.locator(".ticket")).toHaveClass(/\bis-cancelled\b/);
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
    await shot(page, "19-ticket-cancelled");
  });

  test("frees the seats on the seat plan", async ({ page, request }) => {
    const before = (await getSeatPlan(request, plan.showtime.id)).plan.counts.available;
    await cancelOnTicket(page);

    await page.goto(`/showtimes/${plan.showtime.id}`);
    for (const label of labels) {
      await expect(seat(page, label)).toHaveClass(/\bis-available\b/);
      await expect(seat(page, label)).toHaveAttribute("aria-label", new RegExp(`^${label},.*Available$`));
    }
    await expect(page.getByText(`${before + 2} of ${plan.plan.counts.total} seats free`)).toBeVisible();
  });

  test("moves the booking to Past and cancelled, leaving no Upcoming list", async ({ page }) => {
    await cancelOnTicket(page);

    await page.goto("/bookings");
    await expect(page.getByRole("heading", { level: 2, name: "Past and cancelled" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Upcoming" })).toHaveCount(0);
    const pill = page.locator(".booking-row .pill");
    await expect(pill).toHaveText("Cancelled");
    await expect(pill).toHaveClass(/\bpill-bad\b/);
    await expect(page.locator(".booking-row")).toHaveClass(/\bis-cancelled\b/);
    await shot(page, "20-my-bookings-cancelled");
  });

  test("lets another user book the freed seats", async ({ page, request }) => {
    await cancelOnTicket(page);
    const other = await registerUser(request, "Second Buyer");

    await loginWithToken(page, other.token, `/showtimes/${plan.showtime.id}`);
    for (const label of labels) await seat(page, label).click();
    await page.getByRole("button", { name: "Book 2 seats" }).click();

    await expect(page).toHaveURL(/\/bookings\/\d+\?new=1$/);
    await expect(page.locator(".ticket")).toContainText(labels.join(", "));
  });
});

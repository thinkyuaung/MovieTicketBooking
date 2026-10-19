import { expect, test } from "@playwright/test";
import { findShowtime, findShowWithSeats, freeSeats, freshStart, loginWithToken, mmk, registerUser, seat, shot } from "../helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("totals for several seats", () => {
  test("adds standard, VIP and couple prices in Hall 1 (56,000 MMK)", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 2, vip: 1, couple: 1 }, (p) => p.showtime.hall.name === "Hall 1");
    const chosen = [...freeSeats(plan, "standard", 2), ...freeSeats(plan, "vip", 1), ...freeSeats(plan, "couple", 1)];
    await page.goto(`/showtimes/${plan.showtime.id}`);

    for (const s of chosen) await seat(page, s.label).click();

    const lines = page.locator(".picker-summary .lines li");
    await expect(lines).toHaveCount(4);
    await expect(lines.filter({ hasText: "Couple (for 2)" })).toContainText(mmk(25000));
    await expect(lines.filter({ hasText: "VIP" })).toContainText(mmk(15000));
    await expect(page.locator(".picker-summary .total")).toContainText(mmk(8000 + 8000 + 15000 + 25000));
    await shot(page, "21-mixed-seat-total");
  });

  test("updates the total as seats are added and removed", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 3 }, (p) => p.showtime.hall.name === "Hall 2");
    const [a, b, c] = freeSeats(plan, "standard", 3);
    const total = page.locator(".picker-summary .total");
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await seat(page, a.label).click();
    await expect(total).toContainText(mmk(7000));
    await seat(page, b.label).click();
    await seat(page, c.label).click();
    await expect(total).toContainText(mmk(21000));
    await seat(page, b.label).click();
    await expect(total).toContainText(mmk(14000));
  });

  test("charges the same total on the ticket as the summary showed", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowWithSeats(request, { standard: 3, vip: 2 }, (p) => p.showtime.hall.name === "Hall 2");
    const chosen = [...freeSeats(plan, "standard", 3), ...freeSeats(plan, "vip", 2)];
    const expected = mmk(3 * 7000 + 2 * 12000);
    await loginWithToken(page, user.token, `/showtimes/${plan.showtime.id}`);

    for (const s of chosen) await seat(page, s.label).click();
    await expect(page.locator(".picker-summary .total")).toContainText(expected);
    await page.getByRole("button", { name: "Book 5 seats" }).click();

    await expect(page.locator(".ticket")).toContainText("Admit 5");
    await expect(page.locator(".ticket-stub .num")).toHaveText(expected);
  });

  test("prices a Hall 2 whole-hall booking as the sum of all seats", async ({ page, request }) => {
    const plan = await findShowtime(request, (p) => p.plan.fullHall.eligible && p.showtime.hall.name === "Hall 2");
    const sum = plan.plan.seats.filter((s) => s.status === "available").reduce((t, s) => t + (s.price ?? 0), 0);
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await expect(page.getByRole("button", { name: `Book entire hall · ${mmk(sum)}` })).toBeVisible();
  });

  test("lowers the free-seat count after a booking", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowWithSeats(request, { standard: 2 });
    const [a, b] = freeSeats(plan, "standard", 2);
    const { available, total } = plan.plan.counts;
    await loginWithToken(page, user.token, `/showtimes/${plan.showtime.id}`);
    await expect(page.getByText(`${available} of ${total} seats free`)).toBeVisible();

    await seat(page, a.label).click();
    await seat(page, b.label).click();
    await page.getByRole("button", { name: "Book 2 seats" }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await expect(page.getByText(`${available - 2} of ${total} seats free`)).toBeVisible();
  });
});

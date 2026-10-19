import { expect, test } from "@playwright/test";
import { findShowtime, findShowWithSeats, freeSeats, freshStart, loginWithToken, mmk, registerUser, seat, shot } from "../helpers";

const HALL_1 = { standard: 8000, vip: 15000, couple: 25000, fullHall: 800000 };

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("adding a booking", () => {
  test("selecting a seat marks it is-selected and adds it to the summary", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 1 }, (p) => p.showtime.hall.name === "Hall 1");
    const [a] = freeSeats(plan, "standard", 1);
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await seat(page, a.label).click();

    await expect(seat(page, a.label)).toHaveClass(/\bis-selected\b/);
    await expect(seat(page, a.label)).toHaveAttribute("aria-pressed", "true");
    const line = page.locator(".picker-summary .lines li");
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(a.label);
    await expect(line).toContainText("Standard");
    await expect(line).toContainText(mmk(HALL_1.standard));
    await expect(page.locator(".picker-summary .total")).toContainText(mmk(HALL_1.standard));
  });

  test("seats carry their type class (standard, VIP, couple, wheelchair)", async ({ page, request }) => {
    const plan = await findShowtime(request, (p) => p.showtime.hall.name === "Hall 1");
    await page.goto(`/showtimes/${plan.showtime.id}`);

    for (const type of ["standard", "vip", "couple", "wheelchair"] as const) {
      const sample = plan.plan.seats.find((s) => s.type === type)!;
      await expect(seat(page, sample.label)).toHaveClass(new RegExp(`\\bseat-${type}\\b`));
    }
    await shot(page, "11-seat-types");
  });

  test("a taken seat has the is-taken class and can't be selected", async ({ page, request }) => {
    const plan = await findShowtime(request, (p) => p.plan.seats.some((s) => s.status === "taken"));
    const taken = plan.plan.seats.find((s) => s.status === "taken")!;
    await page.goto(`/showtimes/${plan.showtime.id}`);

    const button = seat(page, taken.label);
    await expect(button).toHaveClass(/\bis-taken\b/);
    await expect(button).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled, so force the click a real user can still make.
    await button.click({ force: true });
    await expect(button).not.toHaveClass(/\bis-selected\b/);
    await expect(page.getByText("Click seats on the plan to choose them.")).toBeVisible();
  });

  test("removing the only chosen seat brings back the empty summary", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    await page.goto(`/showtimes/${plan.showtime.id}`);
    await seat(page, a.label).click();
    await expect(page.locator(".picker-summary .lines li")).toHaveCount(1);

    await page.getByRole("button", { name: `Remove ${a.label}` }).click();

    await expect(page.getByText("Click seats on the plan to choose them.")).toBeVisible();
    await expect(page.locator(".picker-summary .total")).toHaveText(/Total\s*0 MMK/);
    await expect(seat(page, a.label)).not.toHaveClass(/\bis-selected\b/);
  });

  test("booking seats opens the ticket with code, seats and total", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowWithSeats(request, { standard: 2 }, (p) => p.showtime.hall.name === "Hall 1");
    const seats = freeSeats(plan, "standard", 2).map((s) => s.label);
    await loginWithToken(page, user.token, `/showtimes/${plan.showtime.id}`);

    for (const label of seats) await seat(page, label).click();
    await page.getByRole("button", { name: "Book 2 seats" }).click();

    await expect(page).toHaveURL(/\/bookings\/\d+\?new=1$/);
    const notice = page.getByRole("status").filter({ hasText: "Booking confirmed" });
    await expect(notice).toHaveClass(/\bnotice-ok\b/);
    const ticket = page.locator("article.ticket");
    await expect(ticket.getByRole("heading", { level: 1 })).toHaveText(plan.showtime.movie.title);
    await expect(ticket).toContainText("Admit 2");
    await expect(ticket).toContainText(seats.join(", "));
    await expect(ticket.locator(".code")).not.toBeEmpty();
    await expect(ticket.locator(".ticket-stub .num")).toHaveText(mmk(2 * HALL_1.standard));
    await shot(page, "12-ticket-confirmed");
  });

  test("a new booking is listed under Upcoming in My bookings", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowWithSeats(request, { vip: 1 }, (p) => p.showtime.hall.name === "Hall 1");
    const [v] = freeSeats(plan, "vip", 1);
    await loginWithToken(page, user.token, `/showtimes/${plan.showtime.id}`);
    await seat(page, v.label).click();
    await page.getByRole("button", { name: "Book 1 seat" }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    await page.goto("/bookings");

    await expect(page.getByRole("heading", { level: 2, name: "Upcoming" })).toBeVisible();
    const row = page.locator(".booking-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(plan.showtime.movie.title);
    await expect(row).toContainText(v.label);
    await expect(row).toContainText(mmk(HALL_1.vip));
    await expect(row.locator(".pill")).toHaveText("Confirmed");
    await expect(row.locator(".pill")).toHaveClass(/\bpill-ok\b/);
    await shot(page, "13-my-bookings-upcoming");
  });

  test("books the whole hall for the full-hall price", async ({ page, request }) => {
    const user = await registerUser(request);
    const plan = await findShowtime(request, (p) => p.plan.fullHall.eligible && p.showtime.hall.name === "Hall 1");
    await loginWithToken(page, user.token, `/showtimes/${plan.showtime.id}`);

    await page.getByRole("button", { name: `Book entire hall · ${mmk(HALL_1.fullHall)}` }).click();
    await expect(page.getByText(`Book all ${plan.plan.counts.total} seats in Hall 1 for ${mmk(HALL_1.fullHall)}?`)).toBeVisible();
    await page.getByRole("button", { name: "Confirm whole hall" }).click();

    await expect(page).toHaveURL(/\/bookings\/\d+\?new=1$/);
    const ticket = page.locator("article.ticket");
    await expect(ticket).toContainText("Private screening");
    await expect(ticket).toContainText(`Entire hall (${plan.plan.counts.total} seats)`);
    await expect(ticket.locator(".ticket-stub .num")).toHaveText(mmk(HALL_1.fullHall));
    await shot(page, "14-whole-hall-ticket");
  });
});

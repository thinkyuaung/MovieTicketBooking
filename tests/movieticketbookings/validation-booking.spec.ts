import { expect, test } from "@playwright/test";
import { apiBook, findShowtime, findShowWithSeats, freeSeats, freshStart, loginWithToken, mmk, registerUser, seat, shot } from "../helpers";

const DAY = 86_400_000;

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("booking validation", () => {
  test("refuses an 11th seat with an info message", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 11 }, (p) => p.showtime.hall.name === "Hall 1");
    const seats = freeSeats(plan, "standard", 11);
    await page.goto(`/showtimes/${plan.showtime.id}`);

    for (const s of seats.slice(0, 10)) await seat(page, s.label).click();
    await seat(page, seats[10].label).click();

    const notice = page.getByRole("status").filter({ hasText: "You can book up to 10 seats at once" });
    await expect(notice).toHaveText("You can book up to 10 seats at once. For a bigger group, book the whole hall.");
    await expect(notice).toHaveClass(/\bnotice-info\b/);
    await expect(seat(page, seats[10].label)).not.toHaveClass(/\bis-selected\b/);
    await expect(page.locator(".picker-summary .lines li")).toHaveCount(10);
    await expect(page.locator(".picker-summary .total")).toContainText(mmk(10 * 8000));
    await shot(page, "15-seat-limit");
  });

  test("clears the seat-limit message on the next valid click", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 11 }, (p) => p.showtime.hall.name === "Hall 1");
    const seats = freeSeats(plan, "standard", 11);
    await page.goto(`/showtimes/${plan.showtime.id}`);
    for (const s of seats) await seat(page, s.label).click();
    await expect(page.getByText("You can book up to 10 seats at once", { exact: false })).toBeVisible();

    await seat(page, seats[0].label).click();

    await expect(page.getByText("You can book up to 10 seats at once", { exact: false })).toHaveCount(0);
    await expect(page.locator(".picker-summary .lines li")).toHaveCount(9);
  });

  test("shows a 409 error when booking a seat someone else just took", async ({ page, request }) => {
    const [buyer, rival] = [await registerUser(request, "Buyer"), await registerUser(request, "Rival")];
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    await page.clock.install();
    await loginWithToken(page, buyer.token, `/showtimes/${plan.showtime.id}`);
    await seat(page, a.label).click();
    // Freeze the page's 5-second refresh so the booking request is what finds the clash.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10));

    await apiBook(request, rival.token, plan.showtime.id, [a.label]);
    await page.getByRole("button", { name: "Book 1 seat" }).click();

    const error = page.getByRole("alert");
    await expect(error).toHaveText(`Sorry, these seats were just taken: ${a.label}.`);
    await expect(error).toHaveClass(/\bnotice-error\b/);
    await expect(seat(page, a.label)).toHaveClass(/\bis-taken\b/);
    await expect(page.locator(".picker-summary .lines li")).toHaveCount(0);
    await shot(page, "16-seat-just-taken");
  });

  test("drops a chosen seat when the refresh shows it was taken", async ({ page, request }) => {
    const [buyer, rival] = [await registerUser(request, "Buyer"), await registerUser(request, "Rival")];
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    await page.clock.install();
    await loginWithToken(page, buyer.token, `/showtimes/${plan.showtime.id}`);
    await seat(page, a.label).click();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10));

    await apiBook(request, rival.token, plan.showtime.id, [a.label]);
    await page.clock.runFor(5000);

    const error = page.getByRole("alert");
    await expect(error).toHaveText(`Sorry, ${a.label} was just taken by someone else.`);
    await expect(error).toHaveClass(/\bnotice-error\b/);
    await expect(seat(page, a.label)).toHaveClass(/\bis-taken\b/);
    await expect(page.getByText("Click seats on the plan to choose them.")).toBeVisible();
  });

  test("hides the whole-hall button for a show less than 7 days away", async ({ page, request }) => {
    const plan = await findShowtime(request, (p) => new Date(p.showtime.startsAt).getTime() < Date.now() + 6 * DAY);
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await expect(page.locator(".whole-hall")).toContainText("Full-hall booking must be made at least 7 days before the show.");
    await expect(page.getByRole("button", { name: /^Book entire hall/ })).toHaveCount(0);
  });

  test("hides the whole-hall button once any seat is booked", async ({ page, request }) => {
    const plan = await findShowtime(
      request,
      (p) => new Date(p.showtime.startsAt).getTime() > Date.now() + 8 * DAY && p.plan.counts.taken > 0,
    );
    await page.goto(`/showtimes/${plan.showtime.id}`);

    await expect(page.locator(".whole-hall")).toContainText("Full-hall booking is only available when no seats are booked.");
    await expect(page.getByRole("button", { name: /^Book entire hall/ })).toHaveCount(0);
  });

  test("sends a guest to log in instead of booking", async ({ page, request }) => {
    const plan = await findShowWithSeats(request, { standard: 1 });
    const [a] = freeSeats(plan, "standard", 1);
    await page.goto(`/showtimes/${plan.showtime.id}`);
    await seat(page, a.label).click();

    await page.getByRole("button", { name: "Log in to book" }).click();

    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/showtimes/${plan.showtime.id}`)}`);
  });
});

test.describe("review validation", () => {
  test("disables Post review while the comment is empty or blank", async ({ page, request }) => {
    const user = await registerUser(request);
    await loginWithToken(page, user.token, "/");
    await page.getByRole("link", { name: /Coco/ }).click();

    const post = page.getByRole("button", { name: "Post review" });
    await expect(post).toBeDisabled();
    await page.locator("#review-comment").fill("   ");
    await expect(post).toBeDisabled();
    await page.locator("#review-comment").fill("Lovely music.");
    await expect(post).toBeEnabled();
  });

  test("posts a review once, then hides the form", async ({ page, request }) => {
    const user = await registerUser(request, "Reviewer");
    await loginWithToken(page, user.token, "/");
    await page.getByRole("link", { name: /Parasite/ }).click();

    await page.locator("#review-score").selectOption("7");
    await page.locator("#review-comment").fill("Sharp and funny.");
    await page.getByRole("button", { name: "Post review" }).click();

    const review = page.locator(".review", { hasText: "Sharp and funny." });
    await expect(review).toContainText("Reviewer");
    await expect(review).toContainText("★ 7/10");
    await expect(page.locator("#review-comment")).toHaveCount(0);
    await shot(page, "17-review-posted");
  });

  test("asks guests to log in before reviewing", async ({ page }) => {
    await page.getByRole("link", { name: /Inception/ }).click();
    await expect(page.getByText("to write a review.")).toBeVisible();
    await expect(page.locator("#review-comment")).toHaveCount(0);
  });
});

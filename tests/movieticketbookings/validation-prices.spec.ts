import { expect, test, type Page } from "@playwright/test";
import { ADMIN, apiLogin, freshStart, loginWithToken, shot, yangonInput } from "../helpers";

const PRICE_FIELDS = ["#price-priceStandard", "#price-priceVip", "#price-priceCouple"] as const;

/**
 * Opens the admin showtimes page as admin with the schedule form showing.
 *
 * @param page - The page.
 * @param token - Admin token.
 */
async function openScheduleForm(page: Page, token: string): Promise<void> {
  await loginWithToken(page, token, "/admin/showtimes");
  await page.getByRole("button", { name: "Schedule showing" }).click();
  await expect(page.getByRole("heading", { name: "Schedule a showing" })).toBeVisible();
}

/**
 * Picks the hall in the schedule form by name.
 *
 * @param page - The page.
 * @param name - e.g. `Hall 1`.
 */
async function chooseHall(page: Page, name: string): Promise<void> {
  const value = await page.locator("#new-show-hall option", { hasText: `${name} (` }).getAttribute("value");
  await page.locator("#new-show-hall").selectOption(value!);
}

/**
 * Submits the schedule form.
 *
 * @param page - The page.
 */
async function submit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
}

/**
 * Reads one validity flag of an input.
 *
 * @param page - The page.
 * @param selector - Input selector.
 * @param flag - ValidityState key.
 * @returns The flag.
 */
async function validity(page: Page, selector: string, flag: keyof ValidityState): Promise<boolean> {
  return page.locator(selector).evaluate((el: HTMLInputElement, f) => el.validity[f] as boolean, flag);
}

test.describe("showtime price validation (admin)", () => {
  let adminToken = "";

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN);
  });

  test.beforeEach(async ({ page }) => {
    await freshStart(page);
    await openScheduleForm(page, adminToken);
  });

  for (const field of PRICE_FIELDS) {
    test(`blocks submit when ${field} is empty`, async ({ page }) => {
      await page.locator(field).fill("");
      await submit(page);
      expect(await validity(page, field, "valueMissing")).toBe(true);
      await expect(page.getByRole("heading", { name: "Schedule a showing" })).toBeVisible();
    });
  }

  test("blocks submit when every price is empty", async ({ page }) => {
    for (const field of PRICE_FIELDS) await page.locator(field).fill("");
    await submit(page);
    for (const field of PRICE_FIELDS) await expect(page.locator(`${field}:invalid`)).toHaveCount(1);
    await expect(page.locator("#price-fullHallPrice:invalid")).toHaveCount(0);
    await shot(page, "08-prices-all-empty");
  });

  test("accepts a price of 0 MMK", async ({ page }) => {
    await page.locator("#new-show-start").fill(yangonInput(30, 9));
    await page.locator("#price-priceStandard").fill("0");
    await submit(page);
    await expect(page.getByRole("status").filter({ hasText: "Scheduled" })).toBeVisible();
  });

  test("rejects a negative price", async ({ page }) => {
    await page.locator("#price-priceStandard").fill("-500");
    await submit(page);
    expect(await validity(page, "#price-priceStandard", "rangeUnderflow")).toBe(true);
    await expect(page.getByRole("heading", { name: "Schedule a showing" })).toBeVisible();
  });

  test("ignores text typed into a price", async ({ page }) => {
    const input = page.locator("#price-priceVip");
    await input.clear();
    await input.pressSequentially("abc");
    await expect(input).toHaveValue("");
    await submit(page);
    expect(await validity(page, "#price-priceVip", "valueMissing")).toBe(true);
  });

  test("rejects a decimal price", async ({ page }) => {
    await page.locator("#price-priceCouple").fill("1500.5");
    await submit(page);
    expect(await validity(page, "#price-priceCouple", "stepMismatch")).toBe(true);
    await expect(page.getByRole("heading", { name: "Schedule a showing" })).toBeVisible();
  });

  test("shows the API error for a price over 100,000,000 MMK", async ({ page }) => {
    await page.locator("#new-show-start").fill(yangonInput(30, 15));
    await page.locator("#price-priceStandard").fill("1000000000");
    await submit(page);

    const error = page.getByRole("alert");
    await expect(error).toHaveText("Number must be less than or equal to 100000000");
    await expect(error).toHaveClass(/\bnotice-error\b/);
    await shot(page, "09-price-too-large");
  });

  test("shows an error when the hall is already busy", async ({ page }) => {
    await chooseHall(page, "Hall 1");
    await page.locator("#new-show-start").fill(yangonInput(3, 13));
    await submit(page);

    const error = page.getByRole("alert");
    await expect(error).toContainText("The hall is busy:");
    await expect(error).toHaveClass(/\bnotice-error\b/);
  });

  test("clears the error after a successful schedule", async ({ page }) => {
    await chooseHall(page, "Hall 1");
    await page.locator("#new-show-start").fill(yangonInput(3, 13));
    await submit(page);
    await expect(page.getByRole("alert")).toBeVisible();

    await page.locator("#new-show-start").fill(yangonInput(31, 9));
    await submit(page);

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Schedule a showing" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Scheduled" })).toContainText("in Hall 1.");
  });

  test("lists a valid showing with its prices", async ({ page }) => {
    // Hall 1 has standard, VIP and couple seats (Hall 2 has no couples, so its couple price shows "–").
    await chooseHall(page, "Hall 1");
    await page.locator("#new-show-start").fill(yangonInput(32, 9));
    await page.locator("#price-priceStandard").fill("1500000");
    await page.locator("#price-priceVip").fill("2000000");
    await page.locator("#price-priceCouple").fill("3000000");
    await submit(page);

    await expect(page.getByRole("status").filter({ hasText: "Scheduled" })).toContainText("in Hall 1.");
    await expect(page.getByRole("cell", { name: "1,500,000 / 2,000,000 / 3,000,000" })).toBeVisible();
    await shot(page, "10-showing-scheduled");
  });
});

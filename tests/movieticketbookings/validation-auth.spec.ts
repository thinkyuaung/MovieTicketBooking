import { expect, test, type Page } from "@playwright/test";
import { ADMIN, AUNG, freshStart, shot, uniqueEmail } from "../helpers";

const REQUIRED_REGISTER_FIELDS = ["#reg-name", "#reg-email", "#reg-password"] as const;

/**
 * Fills the register form; fields left out stay empty.
 *
 * @param page - The page.
 * @param values - Field values by input id.
 */
async function fillRegister(page: Page, values: Partial<Record<string, string>>): Promise<void> {
  for (const [selector, value] of Object.entries(values)) await page.locator(selector).fill(value ?? "");
}

/**
 * Returns valid register values with one unique email.
 *
 * @returns Values by input id.
 */
function validRegister(): Record<string, string> {
  return { "#reg-name": "Thiri", "#reg-email": uniqueEmail("reg"), "#reg-password": "password123" };
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test.describe("register validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  for (const field of REQUIRED_REGISTER_FIELDS) {
    test(`blocks submit when ${field} is empty`, async ({ page }) => {
      const values = validRegister();
      delete values[field];
      await fillRegister(page, values);
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.locator(`${field}:invalid`)).toHaveCount(1);
      expect(await page.locator(field).evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
      await expect(page).toHaveURL(/\/register$/);
    });
  }

  test("blocks submit when every field is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Create account" }).click();
    for (const field of REQUIRED_REGISTER_FIELDS) await expect(page.locator(`${field}:invalid`)).toHaveCount(1);
    await expect(page.locator("#reg-phone:invalid")).toHaveCount(0);
    await expect(page).toHaveURL(/\/register$/);
    await shot(page, "05-register-all-empty");
  });

  test("rejects an email without @", async ({ page }) => {
    await fillRegister(page, { ...validRegister(), "#reg-email": "not-an-email" });
    await page.getByRole("button", { name: "Create account" }).click();
    expect(await page.locator("#reg-email").evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
    await expect(page).toHaveURL(/\/register$/);
  });

  test("rejects a password shorter than 8 characters", async ({ page }) => {
    await fillRegister(page, { ...validRegister(), "#reg-password": "short7c" });
    await page.getByRole("button", { name: "Create account" }).click();
    expect(await page.locator("#reg-password").evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
    await expect(page).toHaveURL(/\/register$/);
  });

  test("shows the API error for an email that is already registered", async ({ page }) => {
    await fillRegister(page, { ...validRegister(), "#reg-email": AUNG.email });
    await page.getByRole("button", { name: "Create account" }).click();

    const error = page.getByRole("alert");
    await expect(error).toHaveText("An account with this email already exists.");
    await expect(error).toHaveClass(/\bnotice-error\b/);
    await shot(page, "06-register-duplicate-email");
  });

  test("creates an account without the optional phone", async ({ page }) => {
    await fillRegister(page, validRegister());
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("banner").getByText("Thiri")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My bookings" })).toBeVisible();
  });
});

test.describe("login validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("blocks submit when email is empty", async ({ page }) => {
    await page.locator("#login-password").fill(AUNG.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#login-email:invalid")).toHaveCount(1);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("blocks submit when password is empty", async ({ page }) => {
    await page.locator("#login-email").fill(AUNG.email);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#login-password:invalid")).toHaveCount(1);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("blocks submit when both fields are empty", async ({ page }) => {
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#login-email:invalid")).toHaveCount(1);
    await expect(page.locator("#login-password:invalid")).toHaveCount(1);
  });

  test("shows an error with the notice-error class for a wrong password", async ({ page }) => {
    await page.locator("#login-email").fill(AUNG.email);
    await page.locator("#login-password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    const error = page.getByRole("alert");
    await expect(error).toHaveText("Wrong email or password.");
    await expect(error).toHaveClass(/\bnotice-error\b/);
    await shot(page, "07-login-wrong-password");
  });

  test("clears the error after a successful login", async ({ page }) => {
    await page.locator("#login-email").fill(AUNG.email);
    await page.locator("#login-password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.locator("#login-password").fill(AUNG.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("banner").getByText(AUNG.name)).toBeVisible();
  });

  test("sends an admin to the dashboard", async ({ page }) => {
    await page.locator("#login-email").fill(ADMIN.email);
    await page.locator("#login-password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("blocks customers from the admin area", async ({ page }) => {
    await page.locator("#login-email").fill(AUNG.email);
    await page.locator("#login-password").fill(AUNG.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Admins only" })).toBeVisible();
  });
});

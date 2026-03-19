import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /log in/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
  });

  test("login form shows validation errors", async ({ page }) => {
    await page.goto("/auth/login");

    // Submit empty form
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();

    // Submit with email but short password
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("short");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(
      page.getByText(/password must be at least 8 characters/i),
    ).toBeVisible();
  });

  test("signup page renders correctly", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(
      page.getByRole("heading", { name: /sign up/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });

  test("signup form shows validation errors", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByRole("button", { name: /sign up/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test("navigate between login and signup", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/auth\/signup/);

    await page.getByRole("link", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("dashboard redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("header shows login button when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });
});

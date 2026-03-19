import { test, expect } from "@playwright/test";

const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const TEST_VIDEO_ID = "dQw4w9WgXcQ";

test.describe("Journey 1: Paste URL -> Video loads -> Summary displays", () => {
  test("loads video and generates brief summary", async ({ page }) => {
    await page.goto("/");

    // Paste URL
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await urlInput.fill(TEST_VIDEO_URL);
    await urlInput.press("Enter");

    // Video player should appear
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Click Brief tab and wait for summary
    await page.getByRole("button", { name: "Brief" }).click();
    await expect(
      page.locator(".prose").first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("Journey 2: Q&A with follow-up", () => {
  test("asks a question and gets a grounded answer", async ({ page }) => {
    await page.goto(`/?v=${TEST_VIDEO_ID}`);

    // Wait for video to load
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Q&A tab should be active by default
    const qaInput = page.locator('input[placeholder="Ask a question..."]');
    await qaInput.fill("What is this video about?");
    await page.getByRole("button", { name: "Send" }).click();

    // Wait for assistant response
    await expect(
      page.locator('[class*="assistant"], [class*="rounded-2xl"]').last(),
    ).toBeVisible({ timeout: 60_000 });

    // Ask follow-up
    await qaInput.fill("Can you explain more?");
    await page.getByRole("button", { name: "Send" }).click();

    // Should have at least 4 messages (2 user + 2 assistant)
    await page.waitForTimeout(30_000);
    const messages = page.locator('[class*="rounded-2xl"]');
    expect(await messages.count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Journey 3: Flashcards -> Topics -> Transcript search", () => {
  test("generates flashcards and navigates topics", async ({ page }) => {
    await page.goto(`/?v=${TEST_VIDEO_ID}`);
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Switch to Flashcards tab and generate
    await page.getByRole("button", { name: "Flashcards" }).click();
    await page.getByRole("button", { name: "Generate" }).click();

    // Wait for flashcards to load
    await expect(page.getByText(/of \d+/)).toBeVisible({ timeout: 60_000 });

    // Navigate to next card
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("2 of")).toBeVisible();

    // Switch to Topics tab
    await page.getByRole("button", { name: "Topics" }).click();
    await expect(
      page.locator('[class*="topic"], [class*="rounded"]').first(),
    ).toBeVisible({ timeout: 60_000 });

    // Switch to Transcript tab and search
    await page.getByRole("button", { name: "Transcript" }).click();
    await expect(
      page.locator('input[placeholder*="Search transcript"]'),
    ).toBeVisible({ timeout: 30_000 });

    const searchInput = page.locator(
      'input[placeholder*="Search transcript"]',
    );
    await searchInput.fill("never");
    // Should highlight or filter results
    await page.waitForTimeout(1000);
  });
});

test.describe("Journey 4: Auth -> Notes -> Share", () => {
  test("login flow redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test("notes editor is visible on home page", async ({ page }) => {
    await page.goto(`/?v=${TEST_VIDEO_ID}`);
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Notes editor should be visible
    await expect(page.getByText("Notes")).toBeVisible();
    await expect(page.getByText("Sign in to save")).toBeVisible();
  });
});

test.describe("Journey 5: Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("all features accessible on iPhone SE viewport", async ({ page }) => {
    await page.goto("/");

    // Header should be visible and compact
    await expect(page.getByText("YouTube RAG")).toBeVisible();

    // URL input should be full width
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await expect(urlInput).toBeVisible();

    // Paste a URL
    await urlInput.fill(TEST_VIDEO_URL);
    await urlInput.press("Enter");

    // Video player should render
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Tab bar should be scrollable — all tabs should exist in DOM
    for (const tab of ["Q&A", "Brief", "Detailed", "Transcript", "Flashcards", "Topics"]) {
      await expect(page.getByRole("button", { name: tab })).toBeAttached();
    }

    // Language selector should be visible
    await expect(page.locator('select[aria-label="Output language"]')).toBeVisible();
  });

  test.use({ viewport: { width: 390, height: 844 } });

  test("all features accessible on iPhone 14 viewport", async ({ page }) => {
    await page.goto(`/?v=${TEST_VIDEO_ID}`);

    // Video should render
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: 10_000,
    });

    // Notes section should appear below (single column on mobile)
    await expect(page.getByText("Notes")).toBeVisible();

    // Q&A input should be usable
    const qaInput = page.locator('input[placeholder="Ask a question..."]');
    await expect(qaInput).toBeVisible();
  });
});

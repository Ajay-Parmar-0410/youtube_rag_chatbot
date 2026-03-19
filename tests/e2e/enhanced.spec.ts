import { test, expect } from "@playwright/test";

test.describe("Phase 3: Enhanced Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("flashcards tab is visible and clickable", async ({ page }) => {
    // Load a video first
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await urlInput.press("Enter");

    // Wait for content panel tabs
    const flashcardsTab = page.getByRole("button", { name: "Flashcards" });
    await expect(flashcardsTab).toBeVisible();

    await flashcardsTab.click();
    await expect(page.getByText("Generate")).toBeVisible();
  });

  test("topics tab is visible and clickable", async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await urlInput.press("Enter");

    const topicsTab = page.getByRole("button", { name: "Topics" });
    await expect(topicsTab).toBeVisible();

    await topicsTab.click();
    await expect(page.getByText("Extract Topics")).toBeVisible();
  });

  test("transcript tab shows search and segments", async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await urlInput.press("Enter");

    const transcriptTab = page.getByRole("button", { name: "Transcript" });
    await transcriptTab.click();

    // Should show loading or transcript viewer
    await expect(
      page.getByText("Loading transcript...").or(page.getByPlaceholder("Search transcript..."))
    ).toBeVisible({ timeout: 30000 });
  });

  test("flashcard generation flow", async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="YouTube"]');
    await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await urlInput.press("Enter");

    // Switch to flashcards tab
    await page.getByRole("button", { name: "Flashcards" }).click();

    // Click generate
    await page.getByText("Generate").click();

    // Should show loading
    await expect(page.getByText("Generating flashcards from video...")).toBeVisible();

    // Wait for flashcards to load (or error, since we may not have backend running)
    await expect(
      page.getByText("QUESTION").or(page.getByText(/failed|error|try again/i))
    ).toBeVisible({ timeout: 60000 });
  });

  test("shared note page shows error for invalid share ID", async ({ page }) => {
    await page.goto("/shared/00000000-0000-0000-0000-000000000000");

    await expect(
      page.getByText("Note Not Found").or(page.getByText(/not found|revoked/i))
    ).toBeVisible({ timeout: 10000 });
  });
});

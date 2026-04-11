import { test, expect } from "@playwright/test";

test("home page loads primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Check API Health" })
  ).toBeVisible();
});

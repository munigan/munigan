import { test, expect } from "@playwright/test";
test("opens Gear Lab without an account", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Gear Lab", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/gear-lab$/);
  await expect(page.getByLabel("Character export")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
});

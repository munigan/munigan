import { expect, type Page } from "@playwright/test";

export async function chooseItemVersion(page: Page, version: string) {
  const button = page
    .getByRole("group", { name: "Item version", exact: true })
    .getByRole("button", {
      name: version === "original" ? "Original 3.3.5a" : "Wrath Classic",
      exact: true,
    });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

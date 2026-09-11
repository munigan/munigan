import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const presets = JSON.parse(readFileSync("data/wotlk/presets.json", "utf8"));
const frost = presets.deathknight.variants.find(
  (variant: { defaultName: string }) => variant.defaultName === "Frost",
);

test("Gear Lab artwork follows the imported character and resets with navigation", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  const backdrop = page.locator(".workbench-backdrop");
  await expect(backdrop).toHaveAttribute("data-theme", "naxxramas");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Frost background check",
      class: "deathknight",
      race: "human",
      level: 80,
      talents: frost.talents.talentsString,
      gear: frost.defaultGear["1"]["4"],
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
    }),
  );
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "DPS preset" })).toHaveText(
    "Frost/Blood (15/56/0)",
  );
  await expect(backdrop).toHaveAttribute("data-theme", "deathknight-frost");
  await expect(backdrop.locator("img")).toHaveJSProperty("complete", true);
  expect(
    await backdrop
      .locator("img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Your equipment/ }),
  ).toBeVisible();
  await expect(backdrop).toHaveAttribute("data-theme", "deathknight-frost");
  await page.getByRole("link", { name: "Gear Lab", exact: true }).click();
  await expect(backdrop).toHaveAttribute("data-theme", "naxxramas");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator(".home-artwork")).toBeVisible();
  await expect(backdrop).toHaveCount(0);
});

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";

const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];

async function importCharacter(page: Page, withBags = false) {
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Slot visibility",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      gear: player.equipment,
      professions: [
        { name: "Engineering", level: 450 },
        { name: "Jewelcrafting", level: 450 },
      ],
    }),
  );
  if (withBags)
    await page
      .getByLabel("Bag export", { exact: true })
      .fill(
        JSON.stringify({ items: [{ id: 40528 }, player.equipment.items[1]] }),
      );
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
}

for (const withBags of [false, true]) {
  test(`fresh import and unchanged draft show every slot ${withBags ? "with" : "without"} bag alternatives`, async ({
    page,
  }) => {
    await page.goto("/gear-lab");
    await importCharacter(page, withBags);
    await expect(page.locator(".slot-group")).toHaveCount(14);
    await expect(page.locator(".expand-slots")).toHaveCount(0);
    await page.getByRole("button", { name: "Weapons", exact: true }).click();
    await expect(page.locator(".slot-group")).toHaveCount(2);
    await page.getByRole("button", { name: "All slots", exact: true }).click();
    await expect(page.locator(".slot-group")).toHaveCount(14);
    await page.reload();
    await page
      .getByRole("button", { name: "Restore draft", exact: true })
      .click();
    await expect(page.locator(".slot-group")).toHaveCount(14);
    await expect(page.locator(".expand-slots")).toHaveCount(0);
  });
}

test("restored drafts show all slots while editing alternatives and enhancements", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  await importCharacter(page, true);
  const candidate = page.getByRole("checkbox", {
    name: /Select Valorous Dreadnaught Helmet, Bags/,
  });
  await candidate.check();
  await page.evaluate(() => {
    const key = "wow-droptimizer.top-gear.v1";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.snapshot.itemEnhancements = {
      [draft.snapshot.equipped.chest]: { enchantId: 0 },
    };
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await expect(page.locator(".expand-slots")).toHaveCount(0);
  await expect(candidate).toBeChecked();
  // Removing the last candidate must not make the table disappear mid-edit.
  await candidate.uncheck();
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await expect(page.locator(".expand-slots")).toHaveCount(0);
  await expect(candidate).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("link", { name: "Gear Lab", exact: true }).click();
  await importCharacter(page);
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await expect(page.locator(".expand-slots")).toHaveCount(0);
});

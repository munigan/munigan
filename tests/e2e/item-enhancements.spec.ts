import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";

const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
async function setup(page: Page) {
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Munigan",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      professions: [
        { name: "Engineering", level: 450 },
        { name: "Jewelcrafting", level: 450 },
      ],
      gear: player.equipment,
    }),
  );
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify({ items: [{ id: 50037, enchant: 0, gems: [] }] }));
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  return page
    .locator('.inventory-row[data-source="bag"]')
    .filter({ hasText: "Fleshrending Gauntlets" });
}

test("row and enhancement clicks edit independently of selection; apply persists overrides and reset restores auto", async ({
  page,
}) => {
  const row = await setup(page);
  const checkbox = row.locator('input[type="checkbox"]');
  await expect(row.locator('[data-enhancement-field="0"] img')).toBeVisible();
  await expect(
    row.locator('[data-enhancement-field="enchant"]'),
  ).not.toHaveText("No enchant");
  const before = await saved(page);
  await row.locator('[data-enhancement-field="enchant"]').hover();
  await expect(page.locator(".compact-enchant-tooltip")).toContainText(
    "Hyperspeed Accelerators",
  );
  await expect(page.locator(".compact-enchant-tooltip")).toContainText("340");
  await page.mouse.move(0, 0);
  await expect(page.locator(".compact-enchant-tooltip")).toHaveCount(0);
  const instanceId = await row.getAttribute("data-instance-id");
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.locator(".item-row-copy .item-tooltip-link").click();
  const dialog = page.getByRole("dialog", { name: "Gems & enchants" });
  await expect(dialog).toBeVisible();
  await expect(checkbox).toBeChecked();
  await dialog.getByRole("searchbox").fill("Etched Ametrine");
  await dialog.getByRole("radio", { name: /Etched Ametrine/ }).click();
  await dialog
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(row.locator('[data-enhancement-field="0"]')).toHaveAttribute(
    "data-manual",
    "true",
  );
  let draft = await saved(page);
  expect(draft.snapshot.itemEnhancements[instanceId!].gemIds[0]).toBe(40143);
  expect(draft.snapshot.inventory).toEqual(before.snapshot.inventory);
  expect(draft.snapshot.equipped).toEqual(before.snapshot.equipped);
  await row.locator('[data-enhancement-field="enchant"]').click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Enchant", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("radio", { name: /No enchant/ }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  draft = await saved(page);
  expect(
    draft.snapshot.itemEnhancements[instanceId!].enchantId,
  ).toBeUndefined();
  await page.reload();
  await page.getByRole("button", { name: /Restore draft/ }).click();
  await expect(row.locator('[data-enhancement-field="0"]')).toHaveAttribute(
    "data-manual",
    "true",
  );
  await row.locator('[data-enhancement-field="0"]').click();
  await dialog.getByRole("radio", { name: /Automatic/ }).click();
  await dialog
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  draft = await saved(page);
  expect(
    draft.snapshot.itemEnhancements?.[instanceId!]?.gemIds?.[0] ?? null,
  ).toBeNull();
});

test("Owned enchant tooltips open on hover and focus while activation edits locally", async ({
  page,
}) => {
  await setup(page);
  const enchant = page
    .locator(
      '.inventory-row [data-enhancement-field="enchant"][href$="spell=59954"]',
    )
    .first();
  const tooltip = page.locator(".compact-enchant-tooltip");
  await enchant.hover();
  await expect(tooltip).toContainText("Arcanum of Torment");
  await expect(tooltip).toContainText("50");
  await page.screenshot({ path: "/tmp/wowhead-enchant-tooltip.png" });
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await enchant.focus();
  await expect(tooltip).toContainText("Arcanum of Torment");
  await enchant.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Gems & enchants" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Enchant", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/gear-lab$/);
  expect(page.context().pages()).toHaveLength(1);
});

test("chest enchants show their spell instead of their formula, including after editing", async ({
  page,
}) => {
  await setup(page);
  const chest = page
    .locator(".inventory-row")
    .filter({ hasText: "Chestguard of the Recluse" });
  const enchant = chest.locator('[data-enhancement-field="enchant"]');
  const tooltip = page.locator(".compact-enchant-tooltip");
  await expect(enchant.locator("img")).toHaveAttribute(
    "src",
    /\/trade_engraving\.jpg$/,
  );
  await enchant.hover();
  await expect(tooltip).toContainText("Powerful Stats");
  await expect(tooltip).not.toContainText("Formula:");
  await expect(tooltip).not.toContainText("Teaches you");
  await page.screenshot({ path: "/tmp/wowhead-powerful-stats-tooltip.png" });
  await enchant.click();
  const editor = page.getByRole("dialog", { name: "Gems & enchants" });
  await expect(
    editor
      .getByRole("radio", { name: /^Powerful Stats/ })
      .locator("..")
      .locator("img"),
  ).toHaveAttribute("src", /\/trade_engraving\.jpg$/);
  await editor.screenshot({ path: "/tmp/enchant-picker-spell-icons.png" });
  await editor.getByRole("searchbox").fill("Super Stats");
  await expect(
    editor
      .getByRole("radio", { name: /^Super Stats/ })
      .locator("..")
      .locator("img"),
  ).toHaveAttribute("src", /\/trade_engraving\.jpg$/);
  await editor.getByRole("radio", { name: /^Super Stats/ }).check();
  await editor
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await enchant.hover();
  await expect(tooltip).toContainText("Super Stats");
  await expect(tooltip).not.toContainText("Powerful Stats");
  await expect(tooltip).not.toContainText("Formula:");
});

test("mobile editor has real filter checkboxes, specific socket navigation and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const row = await setup(page);
  await row.locator('[data-enhancement-field="1"]').click();
  const dialog = page.getByRole("dialog", { name: "Gems & enchants" });
  await expect(dialog.getByRole("heading", { name: /Socket 2/ })).toBeVisible();
  const match = dialog.getByRole("checkbox", { name: "Match socket color" });
  await match.check();
  await expect(match).toBeChecked();
  await dialog.getByRole("searchbox").fill("no such gem");
  await expect(dialog.getByText(/No matching gems/)).toBeVisible();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row.getByRole("checkbox")).not.toBeChecked();
});

test("editor follows Portuguese preference and desktop/mobile layouts", async ({
  page,
}) => {
  const row = await setup(page);
  await row.screenshot({ path: "/tmp/munigan-enhancement-row.png" });
  await row.locator('[data-enhancement-field="0"]').click();
  await page
    .getByRole("dialog")
    .screenshot({ path: "/tmp/munigan-enhancement-desktop.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row.locator('[data-enhancement-field="0"]')).toBeFocused();
  await page
    .context()
    .addCookies([
      { name: "munigan.locale", value: "pt-BR", url: "http://127.0.0.1:3000" },
    ]);
  await page.reload();
  await page
    .getByRole("button", { name: "Restaurar rascunho", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await row.locator('[data-enhancement-field="0"]').click();
  const dialog = page.getByRole("dialog", { name: "Gemas e encantamentos" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "Combinar cor do engaste" }),
  ).toBeVisible();
  await dialog.screenshot({ path: "/tmp/munigan-enhancement-mobile.png" });
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
});

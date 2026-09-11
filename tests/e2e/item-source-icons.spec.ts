import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";

async function importGear(page: Page) {
  const player = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  ).raid.parties[0].players[0];
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Source icons",
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
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify({ items: [{ id: 40528 }] }));
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
}

test("source hints work in rows, pickers and editors without triggering their actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await importGear(page);
  const equipped = page
    .locator('.inventory-row[data-source="equipped"]')
    .first();
  const bag = page.locator('.inventory-row[data-source="bag"]').first();
  const tooltip = page.locator(".app-tooltip-popup");
  const mainImage = equipped.locator(".item-row-icon .item-icon");
  await expect(mainImage).toHaveCSS("width", "44px");
  const desktopCopy = await equipped.locator(".item-row-copy").boundingBox();
  expect(desktopCopy!.height).toBeLessThanOrEqual(44);
  await equipped.getByRole("img", { name: "Equipped", exact: true }).hover();
  await expect(tooltip).toHaveText("Equipped");
  await bag.getByRole("img", { name: "Bags", exact: true }).hover();
  await expect(tooltip).toHaveText("Bags");
  await bag.getByRole("img", { name: "Bags", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bag.getByRole("checkbox")).not.toBeChecked();
  await page.screenshot({ path: "/tmp/item-source-icons-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  const add = page.getByRole("button", {
    name: "Add custom item to Head",
    exact: true,
  });
  await expect(add).toHaveCSS("border-top-width", "1px");
  await expect(add).toHaveCSS("border-top-style", "solid");
  const dividerColor = await bag.evaluate(
    (el) => getComputedStyle(el).borderTopColor,
  );
  await expect(add).toHaveCSS("border-top-color", dividerColor);
  await add.hover();
  await expect(add).toHaveCSS("background-color", "rgb(21, 23, 26)");
  await page.screenshot({ path: "/tmp/add-custom-item-hover.png" });
  await add.click();
  const picker = page.getByRole("dialog", { name: "Add custom items" });
  await picker.getByRole("searchbox").fill("40528");
  await picker.getByRole("img", { name: "Bags", exact: true }).hover();
  await expect(tooltip).toHaveText("Bags");
  // Locator.click follows this label to its disabled checkbox; click the
  // actual hint to verify its independent pointer behavior.
  const hint = await picker
    .getByRole("img", { name: "Bags", exact: true })
    .boundingBox();
  expect(hint).not.toBeNull();
  await page.mouse.click(hint!.x + hint!.width / 2, hint!.y + hint!.height / 2);
  await expect(picker.getByRole("checkbox")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(picker).toBeVisible();
  await picker.getByRole("searchbox").fill("50072");
  await picker.getByRole("checkbox").check();
  await picker.getByRole("button", { name: "Add 1 item", exact: true }).click();
  const custom = page.locator('.inventory-row[data-source="custom"]').first();
  await custom.getByRole("img", { name: "Custom", exact: true }).hover();
  await expect(tooltip).toHaveText("Custom");
  await equipped.locator(".item-row-copy > .item-tooltip-link").click();
  const editor = page.getByRole("dialog", { name: "Gems & enchants" });
  await editor.getByRole("img", { name: "Equipped", exact: true }).hover();
  await expect(tooltip).toHaveText("Equipped");
  const aboveDialog = await tooltip.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return el.contains(
      document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
    );
  });
  expect(aboveDialog).toBe(true);
  await page.screenshot({ path: "/tmp/item-source-icons-editor.png" });
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCopy = await equipped.locator(".item-row-copy").boundingBox();
  expect(mobileCopy!.height).toBeLessThanOrEqual(44);
  await expect(mainImage).toHaveCSS("width", "44px");
  await bag.getByRole("img", { name: "Bags", exact: true }).click();
  await expect(tooltip).toHaveText("Bags");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bag.getByRole("checkbox")).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/item-source-icons-mobile.png" });
});

test.describe("touch source hints", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("tapping a source opens its hint without selecting or editing the item", async ({
    page,
  }) => {
    await importGear(page);
    const bag = page.locator('.inventory-row[data-source="bag"]').first();
    await bag.getByRole("img", { name: "Bags", exact: true }).tap();
    await expect(page.locator(".app-tooltip-popup")).toHaveText("Bags");
    await expect(bag.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("heading", { name: "GEAR LAB", exact: true }).tap();
    await expect(page.locator(".app-tooltip-popup")).toHaveCount(0);
  });
});

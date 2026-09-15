import { chooseItemVersion } from "./item-version";
import { selectOption } from "./select-option";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function setup(page: Page) {
  await page.route("**/api/tooltips/*/*", (route) => {
    const [, version, id] = new URL(route.request().url()).pathname.match(
      /tooltips\/(classic|original)\/(\d+)/,
    )!;
    return route.fulfill({
      json: {
        item: {
          schemaVersion: 1,
          id: Number(id),
          version,
          source: {
            provider: version === "classic" ? "wowhead" : "cavernoftime",
            url:
              version === "classic"
                ? `https://www.wowhead.com/wotlk/item=${id}`
                : `https://wotlk.cavernoftime.com/item=${id}`,
          },
          name: `Fixture item ${id}`,
          quality: 4,
          icon: null,
          itemLevel: 245,
          heroic: true,
          lines: [
            { kind: "binding", text: "Binds when picked up" },
            { kind: "slot", text: "One-Hand", rightText: "Mace" },
            {
              kind: "weapon",
              text: "300 - 550 Damage",
              rightText: "Speed 2.60",
            },
            ...Array.from({ length: 12 }, (_, index) => ({
              kind: "effect",
              text: `Equip: Full effect ${index + 1}, including every functional condition and duration, preserved as readable text.`,
            })),
            { kind: "requirement", text: "Requires Level 80" },
            { kind: "set", text: "(4) Set: Complete set effect." },
          ],
          sockets: ["red"],
          socketBonus: "Socket Bonus: +8 Strength",
        },
        meta: { fetchedAt: "2026-09-11T00:00:00.000Z", cache: "fresh" },
      },
    });
  });
  const fixture = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const player = fixture.raid.parties[0].players[0];
  player.equipment.items[4] = {
    id: 47425,
    enchant: 1144,
    gems: [40133, 40113, 40155],
  };
  player.equipment.items[12] = { id: 45931 };
  player.equipment.items[14] = { id: 47528, enchant: 3789, gems: [40111] };
  player.equipment.items[15] = { id: 47475, enchant: 3789, gems: [40111] };
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Tooltip bounds",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      gear: player.equipment,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
}
const activeTooltip = (page: Page) =>
  page.locator(".classic-compact-tooltip:popover-open").last();

test("Classic Compact enriches both versions and stays scrollable inside short and narrow viewports", async ({
  page,
}) => {
  await setup(page);
  for (const version of ["original", "classic"]) {
    await chooseItemVersion(page, version);
    for (const id of [44006, 47528, 47475, 45931]) {
      const link = page
        .locator(`.inventory-row a[data-item-id="${id}"]`)
        .first();
      await link.hover();
      const tooltip = activeTooltip(page);
      await expect(tooltip).toContainText("Full effect 12");
      await expect
        .poll(async () => (await tooltip.boundingBox())?.width)
        .toBe(336);
      await expect(tooltip).toContainText(
        version === "classic" ? "Wowhead" : "Cavern of Time",
      );
      await page.mouse.move(0, 0);
      await expect(tooltip).toBeHidden();
    }
    const link = page.locator('.inventory-row a[data-item-id="47528"]').first();
    await link.focus();
    const tooltip = activeTooltip(page);
    for (const [width, height] of [
      [320, 240],
      [390, 320],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(async () => {
          const rect = await tooltip.boundingBox();
          return (
            !!rect &&
            rect.x >= 8 &&
            rect.y >= 8 &&
            rect.x + rect.width <= width - 8 &&
            rect.y + rect.height <= height - 8
          );
        })
        .toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 240 });
    await tooltip.hover();
    await page.mouse.wheel(0, 200);
    await expect
      .poll(() => tooltip.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await link.blur();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await expect(page.locator('script[src*="tooltips.js"]')).toHaveCount(0);
});

test("hover crosses the anchor gap; keyboard Escape leaves the item picker dialog open", async ({
  page,
}) => {
  await setup(page);
  const link = page.locator('.inventory-row a[data-item-id="47528"]').first();
  await link.hover();
  const tooltip = activeTooltip(page);
  await expect(tooltip).toContainText("Full effect 12");
  await tooltip.hover();
  await page.waitForTimeout(250);
  await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  await page
    .getByRole("button", { name: "Add custom item to Head", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add custom items" });
  await expect(dialog).toBeVisible();
  const modalLink = dialog.locator("a[data-item-id]").first();
  await modalLink.focus();
  const modalTooltip = activeTooltip(page);
  await expect(modalTooltip).toContainText("Full effect 12");
  await page.setViewportSize({ width: 390, height: 320 });
  await modalTooltip.hover();
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => modalTooltip.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(modalTooltip).toBeHidden();
  await expect(dialog).toBeVisible();
});

test("touch retains gear editing and gives source inspection an explicit close", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await setup(page);
  await page.locator('.inventory-row a[data-item-id="47528"]').first().tap();
  const dialog = page.getByRole("dialog", { name: "Gems & enchants" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).tap();
  await page
    .getByRole("button", { name: "Add custom item to Head", exact: true })
    .tap();
  const picker = page.getByRole("dialog", { name: "Add custom items" });
  await picker.locator("a[data-item-id]").first().tap();
  const tooltip = activeTooltip(page);
  await expect(tooltip).toBeVisible();
  await tooltip.getByRole("button", { name: "Close item details" }).tap();
  await expect(tooltip).toBeHidden();
  await expect(picker).toBeVisible();
  await context.close();
});

test("hovering a second item or gem replaces the keyboard-focused item tooltip", async ({
  page,
}) => {
  await setup(page);
  const row = page
    .locator(".inventory-row")
    .filter({ has: page.locator('a[data-item-id="44006"]') })
    .first();
  const name = row.locator(".item-row-copy > .item-tooltip-trigger > a");
  await name.focus();
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveCount(1);
  await row.locator(".item-enhancement-gem").first().hover();
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveCount(1);
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveAttribute("data-gem", "true");
  await expect(name).toBeFocused();
  await row.locator("a[data-item-icon]").first().hover();
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveCount(1);
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveAttribute("data-gem", "false");
  const enchant = row.locator('[data-enhancement-field="enchant"]');
  await enchant.hover();
  await expect(page.locator(".compact-enchant-tooltip")).toBeVisible();
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveCount(0);
  await enchant.focus();
  await row.locator("a[data-item-icon]").first().hover();
  await expect(
    page.locator(".classic-compact-tooltip:popover-open"),
  ).toHaveCount(1);
  await expect(page.locator(".compact-enchant-tooltip")).toHaveCount(0);
});

test("touch inspects a noneditable trinket from its icon and name without opening an editor", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await setup(page);
  const row = page
    .locator(".inventory-row")
    .filter({ has: page.locator('a[data-item-id="45931"]') })
    .first();
  await expect(row).toHaveAttribute("data-editable", "false");
  for (const link of [
    row.locator("a[data-item-icon]").first(),
    row.locator(".item-row-copy > .item-tooltip-trigger > a"),
  ]) {
    await link.tap();
    const tooltip = activeTooltip(page);
    await expect(tooltip).toContainText("Fixture item 45931");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(context.pages()).toHaveLength(1);
    await tooltip.getByRole("button", { name: "Close item details" }).tap();
    await expect(tooltip).toBeHidden();
  }
  await context.close();
});

test("known content stays uninterrupted with a subtle footer loading dot", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tooltips/*/45931", async (route) => {
    await pending;
    await route.fallback();
  });
  await page.locator('.inventory-row a[data-item-id="45931"]').first().hover();
  const tooltip = activeTooltip(page);
  const bars = tooltip.locator(".compact-tooltip-skeleton");
  const dot = tooltip.locator(
    ".compact-tooltip-footer .compact-tooltip-loading-dot",
  );
  await expect(bars).toHaveCount(0);
  await expect(dot).toHaveCSS("animation-duration", "1.4s");
  await expect(dot).toHaveCSS("animation-name", "tooltip-skeleton-pulse");
  await expect(tooltip.getByRole("status")).toHaveText(
    "Fetching additional details…",
  );
  await expect(tooltip).toHaveCSS("width", "336px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dot).toHaveCSS("animation-name", "none");
  await page.screenshot({
    path: ".artifacts/tooltip-release/loading-state.png",
  });
  release();
  await expect(tooltip).toContainText("Full effect 12");
  await expect(bars).toHaveCount(0);
  await expect(dot).toHaveCount(0);
  await expect(tooltip.locator('[data-reveal="true"]')).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("local chest layout matches enriched sections without rearranging base stats", async ({
  page,
}) => {
  await setup(page);
  await chooseItemVersion(page, "classic");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tooltips/classic/47425", async (route) => {
    await pending;
    await route.fulfill({
      json: JSON.parse(
        readFileSync("tests/fixtures/tooltips/classic-chest.json", "utf8"),
      ),
    });
  });
  await page.locator('.inventory-row a[data-item-id="47425"]').first().hover();
  const tooltip = activeTooltip(page);
  await expect(tooltip).toContainText("Fetching additional details");
  await expect(tooltip).toContainText("Heroic");
  await expect(tooltip.locator('[data-section="stat"]')).toHaveText(
    "347 Armor+116 Stamina+116 Intellect+94 Spirit",
  );
  await expect(tooltip.locator('[data-section="effect"]')).toContainText("86");
  await expect(tooltip.locator(".compact-tooltip-skeleton")).toHaveCount(0);
  const before = (await tooltip.boundingBox())!.height;
  await page.screenshot({ path: ".artifacts/tooltip-release/chest-local.png" });
  release();
  await expect(tooltip).toContainText("Binds when picked up");
  await expect(tooltip.locator('[data-section="stat"]')).toHaveText(
    "347 Armor+116 Stamina+116 Intellect+94 Spirit",
  );
  await expect(tooltip).toContainText("Durability 100 / 100");
  await expect(tooltip.locator(".compact-tooltip-details")).toHaveCSS(
    "opacity",
    "1",
  );
  const after = (await tooltip.boundingBox())!.height;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(40);
  await page.screenshot({
    path: ".artifacts/tooltip-release/chest-enriched.png",
  });
});

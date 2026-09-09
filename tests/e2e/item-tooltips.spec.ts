import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("keeps provider and Original tooltips inside short and narrow viewports", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const player = fixture.raid.parties[0].players[0];
  player.equipment.items[12] = { id: 45931 };
  player.equipment.items[14] = { id: 47528, enchant: 3789, gems: [40111] };
  player.equipment.items[15] = { id: 47475, enchant: 3789, gems: [40111] };
  await page.goto("/top-gear");
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
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await page.locator(".expand-slots").click();
  // Switching provider tooltips can reset their inline width to auto. A long
  // weapon effect must not stretch the box after hovering a different item.
  for (const id of [44006, 47528, 47475, 47528]) {
    await page.locator(`.inventory-row a[href$="item=${id}"]`).first().hover();
    const tooltip = page.locator(".wowhead-tooltip[data-visible=yes]");
    await expect(tooltip).toBeVisible();
    await expect
      .poll(async () => (await tooltip.boundingBox())?.width)
      .toBe(320);
    if (id === 47528) {
      // Reusing the provider box must not shrink its inner tables: right-hand
      // item labels should reach the same content edge as the effect text.
      await expect
        .poll(() =>
          tooltip.evaluate((node) => {
            const style = getComputedStyle(node);
            const contentRight =
              node.getBoundingClientRect().right -
              parseFloat(style.borderRightWidth) -
              parseFloat(style.paddingRight);
            const labels = Array.from(node.querySelectorAll("th")).filter(
              (cell) =>
                /^(Phase 3|Mace|Speed 2\.60)$/.test(
                  cell.textContent?.trim() ?? "",
                ),
            );
            return (
              labels.length === 3 &&
              labels.every(
                (cell) =>
                  Math.abs(cell.getBoundingClientRect().right - contentRight) <
                  2,
              )
            );
          }),
        )
        .toBe(true);
    }
  }
  await page.mouse.move(0, 0);
  for (const id of [44006, 45931]) {
    const link = page.locator(`.inventory-row a[href$="item=${id}"]`).first();
    await link.focus();
    const tooltip = page.locator(
      id === 45931
        ? ".original-item-tooltip:popover-open"
        : ".wowhead-tooltip[data-visible=yes]",
    );
    await expect(tooltip).toBeVisible();
    for (const [width, height] of [
      [320, 240],
      [390, 320],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(async () => {
          const rect = await tooltip.boundingBox();
          const inside =
            !!rect &&
            rect.x >= 8 &&
            rect.y >= 8 &&
            rect.x + rect.width <= width - 8 &&
            rect.y + rect.height <= height - 8;
          return inside
            ? "inside"
            : `${id}@${width}x${height}: ${JSON.stringify(rect)}`;
        })
        .toBe("inside");
    }
    if (id === 44006) {
      await page.setViewportSize({ width: 320, height: 240 });
      await tooltip.hover();
      await page.mouse.wheel(0, 200);
      await expect
        .poll(() => tooltip.evaluate((node) => node.scrollTop))
        .toBeGreaterThan(0);
    }
    await link.blur();
  }
});

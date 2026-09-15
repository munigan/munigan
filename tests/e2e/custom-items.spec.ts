import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";
const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
async function draft(page: Page) {
  // Draft writes are coalesced; exercise the production pagehide flush.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Aldren",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
      gear: player.equipment,
    }),
  );
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify({ items: [{ id: 40528, enchant: 0, gems: [] }] }));
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
});

test("batch picker retains selections across filters, restores drafts and submits custom candidates", async ({
  page,
}) => {
  const before = await draft(page);
  const trigger = page.getByRole("button", {
    name: "Add custom item to Head",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add custom items" });
  const search = dialog.getByRole("searchbox");
  await expect(search).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: "Sort items" })).toHaveText(
    "For your spec",
  );
  await expect(dialog.locator(".custom-picker-row").first()).toHaveAttribute(
    "data-item-id",
    "50712",
  );
  await selectOption(
    dialog.getByRole("combobox", { name: "Sort items" }),
    "level-desc",
  );
  await expect(
    dialog.locator(".custom-picker-row").first(),
  ).not.toHaveAttribute("data-item-id", "50712");
  await selectOption(
    dialog.getByRole("combobox", { name: "Sort items" }),
    "relevance",
  );
  await search.fill("40528");
  await expect(dialog.getByRole("checkbox")).toBeDisabled();
  await search.fill("landsoul");
  await selectOption(dialog.getByLabel("Phase", { exact: true }), "4");
  await selectOption(dialog.getByLabel("Armor", { exact: true }), "armor:4");
  await selectOption(dialog.getByLabel("Source", { exact: true }), "zone:4812");
  await expect(
    dialog.getByRole("button", { name: /More filters/ }),
  ).toBeHidden();
  await dialog.getByLabel("Minimum item level").fill("277");
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Minimum item level").fill("264");
  await dialog.locator('[data-item-id="50072"]').getByRole("checkbox").check();
  await search.fill("Shadowmourne");
  await expect(
    dialog.getByText("No Head items match your search."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Add 2 items", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Add 2 items", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(
    page.locator(".inventory-row[data-source='custom']"),
  ).toHaveCount(2);
  const removeIcon = page
    .locator(".inventory-row[data-source='custom'] .item-remove svg")
    .first();
  expect((await removeIcon.boundingBox())!.width).toBeGreaterThanOrEqual(18);
  const added = await draft(page);
  expect(added.snapshot.equipped).toEqual(before.snapshot.equipped);
  expect(
    added.snapshot.inventory.filter(
      (i: { source: string }) => i.source === "custom",
    ),
  ).toHaveLength(2);
  await page.reload();
  await page.getByRole("button", { name: /Restore draft/ }).click();
  await expect(
    page.locator(".inventory-row[data-source='custom']"),
  ).toHaveCount(2);
  await page.route("**/api/top-gear/jobs", async (route) => {
    const submitted = route.request().postDataJSON();
    expect(
      submitted.snapshot.inventory.filter(
        (i: { source: string }) => i.source === "custom",
      ),
    ).toHaveLength(2);
    expect(submitted.snapshot.equipped).toEqual(before.snapshot.equipped);
    await route.fulfill({
      status: 503,
      json: { error: "Custom candidates received for testing." },
    });
  });
  await page.getByRole("button", { name: "Run Gear Lab", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Custom candidates received" }),
  ).toBeVisible();
  await page
    .locator(".inventory-row[data-source='custom']")
    .first()
    .getByRole("button", { name: /Remove/ })
    .click();
  await expect(
    page.locator(".inventory-row[data-source='custom']"),
  ).toHaveCount(1);
});

test("close cancels a batch and paired/empty slot groups expose the picker", async ({
  page,
}) => {
  const before = await draft(page);
  await page
    .getByRole("button", { name: "Add custom item to Head", exact: true })
    .click();
  await page.getByRole("searchbox").fill("50712");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.keyboard.press("Escape");
  expect(await draft(page)).toEqual(before);
  await expect(page.getByRole("button", { name: /Expand all/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Add custom item to/ }),
  ).toHaveCount(14);
  await page
    .getByRole("button", { name: "Add custom item to Rings", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Rings · Warrior");
  await expect(
    page.getByRole("dialog").getByLabel("Armor", { exact: true }),
  ).toHaveCount(0);
});

test("mobile keeps search and batch actions reachable without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Add custom item to Head", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("searchbox")).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Add items", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await dialog.getByRole("button", { name: /More filters/ }).click();
  await expect(dialog.getByLabel("Source", { exact: true })).toBeVisible();
  await dialog.getByRole("searchbox").fill("50712");
  await dialog.getByRole("checkbox").check();
  await expect(
    dialog.getByRole("button", { name: "Add 1 item", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "Add 1 item", exact: true }).click();
  await expect(
    page.locator(".inventory-row[data-source='custom']"),
  ).toHaveCount(1);
});

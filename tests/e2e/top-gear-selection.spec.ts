import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];

test.beforeEach(async ({ page }) => {
  await page.goto("/top-gear");
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
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
});

test("enhancement dialog retains changes and slot locks clear when their item is deselected", async ({
  page,
}) => {
  const enhancements = page.getByRole("button", {
    name: "Gems, enchants & sockets",
    exact: true,
  });
  await enhancements.click();
  await page.getByLabel("Default gem", { exact: true }).selectOption("40111");
  await page.getByLabel("Copy enchants & profession bonuses").uncheck();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(enhancements).toBeFocused();
  await enhancements.click();
  await expect(page.getByLabel("Default gem", { exact: true })).toHaveValue(
    "40111",
  );
  await expect(
    page.getByLabel("Copy enchants & profession bonuses"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  const bag = page.getByRole("checkbox", {
    name: /Select Valorous Dreadnaught Helmet, bag/,
  });
  await expect(bag).not.toBeChecked();
  await bag.check();
  await page.getByLabel("Head locks", { exact: true }).click();
  const lock = page.getByRole("combobox", { name: "Head", exact: true });
  const bagId = await lock
    .locator("option")
    .filter({ hasText: /bag/ })
    .getAttribute("value");
  await lock.selectOption(bagId!);
  await page.getByLabel("Head locks", { exact: true }).click();
  await expect(page.getByLabel("Head locks", { exact: true })).toContainText(
    "Locked",
  );
  await bag.uncheck();
  await page.getByLabel("Head locks", { exact: true }).click();
  await expect(lock).toHaveValue("unlocked");
});

test("mobile run action stays reachable and shows submission errors beside the action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Expand all/ }).click();
  await page.locator(".slot-group").last().scrollIntoViewIfNeeded();
  const run = page.getByRole("button", { name: "Find Top Gear", exact: true });
  await expect(run).toBeInViewport({ ratio: 1 });
  const action = page.locator(".run-action");
  await expect(action).toContainText("sets");
  // Exercise the real submission path without scheduling simulator work.
  await page.route("**/api/top-gear/jobs", async (route) => {
    expect(route.request().postDataJSON().tool).toBe("top-gear");
    await route.fulfill({
      status: 503,
      json: { error: "Simulation service is temporarily unavailable." },
    });
  });
  await run.click();
  await expect(action.getByRole("alert")).toContainText(
    "Simulation service is temporarily unavailable.",
  );
  await expect(action.getByRole("alert")).toBeInViewport({ ratio: 1 });
  await expect(run).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];

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

test("enhancement dialog retains changes and items are selected individually", async ({
  page,
}) => {
  const enhancements = page.getByRole("button", {
    name: "Gems, enchants & sockets",
    exact: true,
  });
  await enhancements.click();
  await selectOption(page.getByLabel("Default gem", { exact: true }), "40111");
  await page.getByLabel("Copy enchants & profession bonuses").uncheck();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(enhancements).toBeFocused();
  await enhancements.click();
  await expect(page.getByLabel("Default gem", { exact: true })).toHaveAttribute(
    "data-select-value",
    "40111",
  );
  await expect(
    page.getByLabel("Copy enchants & profession bonuses"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  const bag = page.getByRole("checkbox", {
    name: /Select Valorous Dreadnaught Helmet, Bags/,
  });
  await expect(bag).not.toBeChecked();
  const itemLink = page.locator(".inventory .item-tooltip-link").first();
  await itemLink.hover();
  await expect(itemLink).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator(".inventory-row").first()).toHaveCSS(
    "background-color",
    "rgb(32, 35, 41)",
  );
  await expect(
    page.locator(".item-source .item-source-icon").first(),
  ).toHaveAttribute("aria-label", "Equipped");
  await bag.check();
  await expect(bag).toBeChecked();
  await bag.uncheck();
  await expect(bag).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: /^(Equipped only|Select all|Clear slot)$/,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".locks, .slot-actions")).toHaveCount(0);
  await expect(
    page.locator(".inventory-row").getByText("Details", { exact: true }),
  ).toHaveCount(0);
});

test("mobile run action stays reachable and shows submission errors beside the action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await page.locator(".slot-group").last().scrollIntoViewIfNeeded();
  const run = page.getByRole("button", { name: "Run Gear Lab", exact: true });
  await run.scrollIntoViewIfNeeded();
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

test("restoring a legacy draft clears retired slot locks", async ({ page }) => {
  await page.evaluate(() => {
    const key = "wow-droptimizer.top-gear.v1";
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.selection.lockedSlots = { head: draft.snapshot.equipped.head };
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await page.getByRole("button", { name: /Restore draft/ }).click();
  await expect(
    page.getByRole("heading", { name: /Your equipment/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!)
          .selection.lockedSlots,
    ),
  ).toEqual({});
  const bag = page.getByRole("checkbox", {
    name: /Select Valorous Dreadnaught Helmet, Bags/,
  });
  await bag.check();
  await expect(bag).toBeChecked();
});

test("shared selects keep their chevron inset and their popup inside narrow viewports", async ({
  page,
}) => {
  const version = page.getByRole("combobox", {
    name: "Item version",
    exact: true,
  });
  await expect(version).toContainText("Original WotLK 3.3.5a");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await version.scrollIntoViewIfNeeded();
    const inset = await version.evaluate(
      (el) =>
        el.getBoundingClientRect().right -
        el.querySelector(".app-select-chevron")!.getBoundingClientRect().right,
    );
    expect(inset).toBeGreaterThanOrEqual(12);
    await version.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const popup = page.locator(".app-select-popup");
    await expect
      .poll(async () => {
        const box = await popup.boundingBox();
        return (
          !!box &&
          box.x >= 11 &&
          box.x + box.width <= width - 11 &&
          box.y >= 11 &&
          box.y + box.height <= 689
        );
      })
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(version).toBeFocused();
  }
  await page
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  const gem = page.getByRole("combobox", { name: "Default gem", exact: true });
  await gem.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect
    .poll(async () => {
      const box = await page.locator(".app-searchable-popup").boundingBox();
      return (
        !!box &&
        box.x >= 11 &&
        box.x + box.width <= 309 &&
        box.y >= 11 &&
        box.y + box.height <= 689
      );
    })
    .toBe(true);
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(gem).toBeFocused();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("gem pickers search names and bonuses, show icons, and preserve choices", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  const trigger = page.getByRole("combobox", {
    name: "Default gem",
    exact: true,
  });
  await trigger.click();
  const search = page.getByRole("combobox", {
    name: "Search default gem",
    exact: true,
  });
  await expect(search).toBeFocused();
  await search.fill("ametrine");
  const reckless = page.getByRole("option", {
    name: "Reckless Ametrine",
    exact: true,
  });
  await expect(reckless).toHaveAccessibleDescription(
    "+12 Spell Power · +10 Haste",
  );
  await expect(reckless.locator("img")).toHaveAttribute(
    "src",
    /inv_jewelcrafting_gem_39/,
  );
  await search.fill("Haste");
  await expect(reckless).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Bold Cardinal Ruby", exact: true }),
  ).toHaveCount(0);
  await search.fill("does-not-exist");
  await expect(page.getByText("No gems match your search.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute("data-select-value", "40155");
  await trigger.click();
  await expect(search).toHaveValue("");
  await search.fill("Reckless Ametrine");
  await expect(reckless).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("data-select-value", "40155");
  await expect(trigger).toHaveText("Reckless Ametrine");

  for (const [label, name, description] of [
    [
      "Meta gem",
      "Relentless Earthsiege Diamond",
      "+21 Agility · 3% increased critical damage",
    ],
    ["Jewelcrafting gem", "Bold Dragon's Eye", "+34 Strength"],
  ]) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page
      .getByRole("combobox", {
        name: `Search ${label.toLowerCase()}`,
        exact: true,
      })
      .fill(name);
    const option = page.getByRole("option", { name, exact: true });
    await expect(option).toHaveAccessibleDescription(description);
    await expect(option.locator("img")).toBeVisible();
    await option.click();
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  await expect(trigger).toHaveText("Reckless Ametrine");
});

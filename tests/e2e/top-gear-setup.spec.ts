import { chooseItemVersion } from "./item-version";
import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
test("imports owned bags, exposes exclusions and preserves a free anonymous gear selection", async ({
  page,
}) => {
  // Import and exclusion remain usable when enrichment is unavailable.
  await page.route("**/api/tooltips/*/*", (route) => route.abort());
  await page.goto("/gear-lab");
  const player = fixture.raid.parties[0].players[0];
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
  await page.getByLabel("Bag export", { exact: true }).fill(
    JSON.stringify({
      items: [
        { id: 40528, enchant: 3817, gems: [41285, 39996] },
        { id: 33447 },
        { id: 9999999 },
      ],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear" }).click();
  await chooseItemVersion(page, "classic");
  await expect(page.locator(".unsupported-bag .bag-grid")).toBeHidden();
  await page.locator(".unsupported-bag > summary").click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  await expect(
    page.locator(
      ".unsupported-bag input, .unsupported-bag button, .bag-excluded-mark",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".unsupported-bag").getByRole("link")).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("list", { name: "Unsupported bag items" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  // This assertion checks imported gems; automatic preparation has separate coverage.
  await page
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  await page.getByLabel("Automatically fill empty sockets").uncheck();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const helmetLink = page
    .locator(".inventory-row a[data-item-enhancements]")
    .filter({ hasText: "Valorous Dreadnaught Helmet" });
  await expect(helmetLink).toHaveAttribute(
    "href",
    /wowhead.com\/wotlk\/item=40528/,
  );
  await expect(helmetLink).toHaveAttribute(
    "data-item-enhancements",
    "ench=3817&gems=41285:39996",
  );
  await expect(
    page.getByRole("button", { name: "Run Gear Lab" }),
  ).toBeEnabled();
  const bagHelmet = page.getByRole("checkbox", {
    name: /Select Valorous Dreadnaught Helmet, Bags/,
  });
  await expect(bagHelmet).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Select Obsidian Greathelm, Equipped/ }),
  ).toBeChecked();
  const url = page.url();
  const tabs = page.context().pages().length;
  await bagHelmet.click();
  expect(page.url()).toBe(url);
  expect(page.context().pages()).toHaveLength(tabs);
  await bagHelmet.check();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore draft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  await page.route("**/api/top-gear/jobs", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The simulation queue is full. Try again shortly.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Run Gear Lab" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The simulation queue is full" }),
  ).toContainText("Try again shortly");
  await expect(bagHelmet).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Run Gear Lab" }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

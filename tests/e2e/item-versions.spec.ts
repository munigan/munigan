import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);

test("switches item versions, preserves drafts and simulates their actual stats", async ({
  page,
}) => {
  test.setTimeout(180000);
  const player = structuredClone(fixture.raid.parties[0].players[0]);
  player.equipment.items[12] = { id: 45931 };
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Item Versions",
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
    .fill(JSON.stringify({ items: [{ id: 45931 }] }));
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear" }).click();
  const version = page.getByLabel("Item version", { exact: true });
  await expect(version).toHaveAttribute("data-select-value", "original");
  const mjolnir = page
    .locator(".inventory-row")
    .filter({ hasText: "Mjolnir Runestone" })
    .first();
  await expect(mjolnir.locator(".item-level")).toHaveText("226");
  await mjolnir.locator("a[data-item-version='original']").first().focus();
  const tooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "Mjolnir Runestone" })
    .first();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("665 armor penetration");
  await expect(tooltip).toContainText("+102 Crit");
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  const bagMjolnir = page.getByRole("checkbox", {
    name: /Select Mjolnir Runestone, Bags/,
  });
  await bagMjolnir.check();
  await selectOption(version, "classic");
  await expect(bagMjolnir).toBeChecked();
  await expect(mjolnir.locator(".item-level")).toHaveText("239");
  await expect(mjolnir.locator("a[data-wowhead]").first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(version).toHaveAttribute("data-select-value", "classic");
  await expect(bagMjolnir).toBeChecked();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await page.getByRole("tab", { name: "Encounter", exact: true }).click();
  await page.getByLabel("Fight length (seconds)", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  const crit: Record<string, number> = {};
  const urls: Record<string, string> = {};
  for (const profile of ["original", "classic"]) {
    await selectOption(version, profile);
    await expect(bagMjolnir).toBeChecked();
    await page.getByRole("button", { name: "Run Gear Lab" }).click();
    await expect(page).toHaveURL(/\/reports\//);
    await expect(
      page.getByText("All admitted combinations evaluated", { exact: false }),
    ).toBeAttached({ timeout: 90000 });
    urls[profile] = page.url();
    const response = await page.request.get(
      page.url().replace("/reports/", "/api/reports/"),
    );
    const { report } = await response.json();
    expect(report.snapshot.itemVersion).toBe(profile);
    const baseline = report.rows.find(
      (row: { isEquipped: boolean }) => row.isEquipped,
    );
    expect(baseline).toBeTruthy();
    crit[profile] = baseline.stats[13];
    await expect(page.locator(".report-item-version")).toContainText(
      profile === "original" ? "Original WotLK" : "Blizzard Wrath Classic",
    );
    if (profile === "original") {
      const originalLink = page
        .locator(
          ".gear-strip a[data-item-version='original'][href$='item=45931']",
        )
        .first();
      await originalLink.focus();
      await expect(
        page
          .getByRole("tooltip")
          .filter({ hasText: "Mjolnir Runestone" })
          .first(),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Edit & run again" }).click();
    }
  }
  expect(crit.classic - crit.original).toBeCloseTo(13, 6);
  await page.goto(urls.original);
  await expect(page.locator(".report-item-version")).toContainText(
    "Original WotLK",
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

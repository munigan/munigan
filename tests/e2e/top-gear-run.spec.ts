import { chooseItemVersion } from "./item-version";
import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
test("runs real local DPS and compares complete owned sets", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
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
      items: [{ id: 40528, enchant: 0, gems: [] }],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear" }).click();
  await page
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  await expect(
    page.getByLabel("Copy enchants & profession bonuses"),
  ).toBeChecked();
  await expect(
    page.getByLabel("Automatically fill empty sockets"),
  ).toBeChecked();
  await selectOption(page.getByLabel("Default gem", { exact: true }), "40111");
  await expect(page.getByLabel("Default gem", { exact: true })).toHaveAttribute(
    "data-select-value",
    "40111",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await chooseItemVersion(page, "classic");
  await page
    .getByRole("checkbox", { name: /Select Valorous Dreadnaught Helmet, Bags/ })
    .check();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await page.getByRole("tab", { name: "Encounter", exact: true }).click();
  await page.getByLabel("Fight length (seconds)", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run Gear Lab" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "tests/artifacts/top-gear-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Run Gear Lab" }).click();
  await expect(page).toHaveURL(/\/reports\//);
  await expect(
    page.getByRole("heading", { name: /Gear combinations/ }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("All admitted combinations evaluated", { exact: false }),
  ).toBeAttached({ timeout: 90000 });
  await expect(
    page.locator(".gear-strip a[data-item-enhancements]").first(),
  ).toHaveAttribute(
    "href",
    /(?:wowhead\.com\/wotlk\/|cavernoftime\.com\/)item=/,
  );
  const setButton = page
    .locator(".combination-row")
    .nth(1)
    .getByRole("button", { name: /^View set 2,/ });
  await setButton.focus();
  await page.keyboard.press("Enter");
  await expect(setButton).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".set-changes a[data-item-enhancements]").first(),
  ).toBeVisible();
  await expect(page.locator("button a[data-item-enhancements]")).toHaveCount(0);
  await page.getByRole("button", { name: "Stats details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator("tbody td").first(),
  ).not.toBeEmpty();
  await page.setViewportSize({ width: 320, height: 320 });
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: "tests/artifacts/top-gear-report-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tests/artifacts/top-gear-report-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const gains = await page
    .locator(".combination-row > .dps-change")
    .allTextContents();
  await page.getByLabel("Top set", { exact: true }).check();
  expect(
    await page.locator(".combination-row > .dps-change").allTextContents(),
  ).toEqual(gains);
  await expect(page.getByText("vs. equipped", { exact: true })).toBeVisible();
  const reportUrl = page.url();
  const shared = await browser.newContext();
  const apiUrl = reportUrl.replace("/reports/", "/api/reports/");
  const publicReport = await (await shared.request.get(apiUrl)).json();
  expect(publicReport.canManage).toBe(false);
  expect(publicReport.report.coverage.exhaustive).toBe(true);
  expect(publicReport.report.rows).toHaveLength(2);
  expect(publicReport.report.snapshot.gemming.defaultGemId).toBe(40111);
  const candidate = publicReport.report.rows.find(
    (row: { isEquipped: boolean }) => !row.isEquipped,
  );
  expect(candidate.gemOverrides[candidate.loadout.head][0]).toBe(41285);
  expect(candidate.enchantOverrides[candidate.loadout.head]).toBe(3817);
  await expect(page.locator(".combination-table")).toHaveCSS(
    "border-radius",
    "8px",
  );
  await expect(page.locator(".combination-table")).toHaveCSS(
    "border-left-width",
    "1px",
  );
  expect(candidate.gemOverrides[candidate.loadout.head][1]).toBeGreaterThan(0);
  expect(
    publicReport.report.rows.find(
      (row: { isEquipped: boolean }) => row.isEquipped,
    ).gemOverrides,
  ).toEqual({});
  const sharedPage = await shared.newPage();
  await sharedPage.goto(reportUrl);
  await expect(
    sharedPage.getByRole("heading", { name: /Gear combinations/ }),
  ).toBeVisible();
  await shared.close();
  await expect(
    page.getByRole("button", {
      name: /Use selected set as a new equipped reference/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit & run again" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/gear-lab");
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  const unchanged = await (await page.request.get(apiUrl)).json();
  expect(unchanged.report).toEqual(publicReport.report);
});

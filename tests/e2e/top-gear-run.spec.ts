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
  await page.goto("/top-gear");
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
      items: [{ id: 40528, enchant: 3817, gems: [41285, 39996] }],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear" }).click();
  await page
    .getByRole("checkbox", { name: /Select Valorous Dreadnaught Helmet, bag/ })
    .check();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await page.getByLabel("Fight length (seconds)").fill("30");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("button", { name: "Find Top Gear" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "tests/artifacts/top-gear-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Find Top Gear" }).click();
  await expect(page).toHaveURL(/\/reports\//);
  await expect(
    page.getByRole("heading", { name: /Gear combinations/ }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("All admitted combinations evaluated", { exact: false }),
  ).toBeAttached({ timeout: 90000 });
  await expect(
    page.locator(".gear-strip a[data-wowhead]").first(),
  ).toHaveAttribute("href", /wowhead\.com\/wotlk\/item=/);
  const setButton = page.locator(".combination-row").nth(1).getByRole("button");
  await setButton.focus();
  await page.keyboard.press("Enter");
  await expect(setButton).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".changed-icons a[data-wowhead]").first(),
  ).toBeVisible();
  await expect(page.locator("button a[data-wowhead]")).toHaveCount(0);
  await page.getByRole("button", { name: "Full gear details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".full-gear-row")).toHaveCount(17);
  await expect(
    page.locator(".full-gear-row a[data-wowhead]").first(),
  ).toBeVisible();
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
    .locator(".combination-row > .gain")
    .allTextContents();
  await page.getByLabel("Top set", { exact: true }).check();
  expect(
    await page.locator(".combination-row > .gain").allTextContents(),
  ).toEqual(gains);
  await expect(page.getByText("vs. equipped", { exact: true })).toBeVisible();
  const reportUrl = page.url();
  const shared = await browser.newContext();
  const apiUrl = reportUrl.replace("/reports/", "/api/reports/");
  const publicReport = await (await shared.request.get(apiUrl)).json();
  expect(publicReport.canManage).toBe(false);
  expect(publicReport.report.coverage.exhaustive).toBe(true);
  expect(publicReport.report.rows).toHaveLength(8);
  const sharedPage = await shared.newPage();
  await sharedPage.goto(reportUrl);
  await expect(
    sharedPage.getByRole("heading", { name: /Gear combinations/ }),
  ).toBeVisible();
  await shared.close();
  await page
    .getByRole("button", {
      name: "Use selected set as a new equipped reference",
    })
    .click();
  await page.getByRole("button", { name: "Create new draft" }).click();
  await expect(page).toHaveURL(/\/top-gear$/);
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  const unchanged = await (await page.request.get(apiUrl)).json();
  expect(unchanged.report).toEqual(publicReport.report);
});

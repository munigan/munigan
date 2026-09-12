import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { purchaseReportFixture } from "../support/report-fixture";

const artifacts = ".artifacts/gear-lab-purchases";
test("selected report rows retain distinct frozen plans, item links and original edit inventory", async ({
  page,
}) => {
  const fixture = purchaseReportFixture();
  mkdirSync(artifacts, { recursive: true });
  await page.route("**/api/reports/purchase-report?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/purchase-report");
  const panel = page.getByRole("complementary", { name: "Your purchase plan" });
  await expect(panel).toContainText("1 final item · 2 steps");
  await expect(
    panel.getByRole("row", { name: /Emblems of Frost/ }),
  ).toContainText("40");
  await expect(panel).toContainText("Uses the item from step 1");
  const prerequisite = panel
    .locator(".purchase-plan-steps li")
    .first()
    .getByRole("link");
  await expect(prerequisite).toHaveAttribute("href", /item=50082/);
  // Follow the real item link while intercepting only the external document.
  await page.context().route("https://www.wowhead.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Prerequisite item 50082</h1>",
    }),
  );
  const opened = page.waitForEvent("popup");
  await prerequisite.click();
  const popup = await opened;
  await expect(popup).toHaveURL(/item=50082/);
  await popup.close();
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${artifacts}/board-05-report-desktop.png`,
    fullPage: true,
  });
  await panel.screenshot({ path: `${artifacts}/board-05-plan-panel.png` });
  await page.locator(".combination-row").nth(1).click();
  await expect(panel).toContainText("1 final item · 1 step");
  await expect(
    panel.getByRole("row", { name: /Mark of Sanctification/ }),
  ).toContainText("1");
  await expect(panel).not.toContainText("Uses the item from step 1");
  await page.locator(".combination-row.equipped-row").click();
  await expect(panel).toContainText("No purchases needed");
  const unusedFrost = panel.getByRole("row", { name: /Emblems of Frost/ });
  await expect(unusedFrost.getByRole("cell").nth(0)).toHaveText("0");
  await expect(unusedFrost.getByRole("cell").nth(1)).toHaveText("100");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${artifacts}/board-09-unused-resources.png`,
    fullPage: true,
  });
  await panel.screenshot({ path: `${artifacts}/board-09-unused-panel.png` });
  await page.locator(".combination-row").first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  const gear = page.locator(".gear-strip:not(.gear-strip-compact)").first();
  await expect(gear.locator(".gear-slot")).toHaveCount(17);
  for (const label of ["Off hand", "Ranged"]) {
    const slot = gear
      .locator(".gear-slot")
      .filter({ has: page.getByText(label, { exact: true }) });
    await slot.scrollIntoViewIfNeeded();
    await expect(slot).toBeInViewport({ ratio: 1 });
  }
  await page.screenshot({ path: `${artifacts}/report-mobile-final-slots.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${artifacts}/board-08-report-mobile-viewport.png`,
  });
  await page.screenshot({
    path: `${artifacts}/board-08-report-mobile.png`,
    fullPage: true,
  });
  await panel.screenshot({ path: `${artifacts}/board-08-plan-panel.png` });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // A newer local draft must not reprice an already saved report.
  await page.evaluate(() =>
    localStorage.setItem(
      "wow-droptimizer.top-gear.v1",
      JSON.stringify({ purchases: { balances: { frost: 999 } } }),
    ),
  );
  await page.reload();
  await expect(
    panel.getByRole("row", { name: /Emblems of Frost/ }),
  ).toContainText("40");
  await page
    .getByRole("button", { name: "Edit & run again", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Your equipment/ }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
  expect(saved.purchases).toEqual(fixture.report.purchases.inputs);
  expect(saved.snapshot.inventory).toEqual(
    fixture.report.purchases.originalSnapshot.inventory,
  );
  expect(
    saved.snapshot.inventory.some(
      (i: { source: string }) => i.source === "purchase",
    ),
  ).toBe(false);
  expect(
    saved.selection.selectedInstanceIds.some((id: string) =>
      id.startsWith("purchase-"),
    ),
  ).toBe(false);
});

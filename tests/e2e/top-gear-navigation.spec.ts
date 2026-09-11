import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { reportFixture } from "../support/report-fixture";
import versions from "../../data/wotlk/versions.json" with { type: "json" };
const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
const character = JSON.stringify({
  name: "Munigan",
  class: "warrior",
  race: "human",
  level: 80,
  talents: player.talentsString,
  gear: player.equipment,
});

for (const mobile of [false, true]) {
  test(`Top Gear menu returns selection to import and preserves the draft (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 900 });
    const fixture = reportFixture();
    fixture.report.snapshot.versions = versions;
    await page.route("**/api/reports/navigation-report?*", (route) =>
      route.fulfill({ json: fixture }),
    );
    await page.goto("/reports/navigation-report");
    await page
      .getByRole("button", { name: "Edit & run again", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /^Your equipment/ }),
    ).toBeVisible();
    const before = await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    );
    if (mobile)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .locator(mobile ? ".workbench-drawer" : ".workbench-header")
      .getByRole("link", { name: /^Gear Lab/ })
      .click();
    await expect(
      page.getByLabel("Character export", { exact: true }),
    ).toBeVisible();
    const notice = page.getByRole("status", { name: "Saved selection" });
    await expect(
      notice.getByText("Report preview", { exact: true }),
    ).toBeVisible();
    await expect(notice.getByText("1 bag item", { exact: true })).toBeVisible();
    await expect(notice.locator(".character-class-image")).toBeVisible();
    await expect(notice).toHaveCSS("background-color", "rgb(23, 25, 29)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await notice.screenshot({
      path: `/tmp/compact-draft-${mobile ? "mobile" : "desktop"}.png`,
    });
    expect(
      await page.evaluate(() =>
        localStorage.getItem("wow-droptimizer.top-gear.v1"),
      ),
    ).toBe(before);
    await page
      .getByRole("button", { name: "Restore draft", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /^Your equipment/ }),
    ).toBeVisible();
  });
}

test("menu preserves an import review across a reload and restores it", async ({
  page,
}) => {
  await page.goto("/top-gear");
  await page.getByLabel("Character export", { exact: true }).fill(character);
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify({ items: [{ id: 40528 }] }));
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Munigan", exact: true }),
  ).toBeVisible();
  await page
    .locator(".workbench-header")
    .getByRole("link", { name: /^Gear Lab/ })
    .click();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveValue("");
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Munigan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Your equipment/ }),
  ).toBeVisible();
});

test("an unfinished Warmane review restores without another Armory lookup", async ({
  page,
}) => {
  let lookups = 0;
  await page.route("**/api/import/warmane?*", (route) => {
    lookups++;
    const imported = JSON.parse(character);
    delete imported.talents;
    return route.fulfill({ json: { character: imported } });
  });
  await page.goto("/top-gear");
  await page
    .getByRole("button", { name: "Warmane Armory", exact: true })
    .click();
  await expect(
    page.getByLabel("Character name", { exact: true }),
  ).toHaveAttribute("placeholder", "Munigan");
  await page.getByLabel("Character name", { exact: true }).fill("Munigan");
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Munigan", exact: true }),
  ).toBeVisible();
  await page
    .locator(".workbench-header")
    .getByRole("link", { name: /^Gear Lab/ })
    .click();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Munigan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select gear", exact: true }),
  ).toBeDisabled();
  expect(lookups).toBe(1);
  await page
    .locator(".workbench-header")
    .getByRole("link", { name: /^Gear Lab/ })
    .click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true }),
  ).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import { reportFixture } from "../support/report-fixture";
import versions from "../../data/wotlk/versions.json" with { type: "json" };

test("editing a report opens equipment selection with its original setup", async ({
  page,
}) => {
  const fixture = reportFixture();
  fixture.report.snapshot.inventory.push({
    ...fixture.report.snapshot.inventory.find(
      (item) => item.equippedSlot === "neck",
    )!,
    instanceId: "unselected-neck",
    source: "bag",
    equippedSlot: undefined,
  });
  fixture.report.snapshot.versions = versions;
  await page.route("**/api/reports/edit-report?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/edit-report");
  await page
    .getByRole("button", { name: "Edit & run again", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Your equipment/ }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".slot-group")).toHaveCount(14);
  await expect(page.locator(".expand-slots")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
  expect(saved.selection.selectedInstanceIds).toEqual(
    fixture.report.selection.selectedInstanceIds,
  );
  expect(saved.snapshot.inventory).toEqual(fixture.report.snapshot.inventory);
  expect(saved.snapshot.itemVersion).toBe("classic");
  expect(saved.snapshot.settings.encounter.duration).toBe(
    fixture.report.snapshot.settings.encounter.duration,
  );
  expect(saved.snapshot.settings.player.name).toBe("Report preview");
});

test("an edit link without a saved draft safely shows import", async ({
  page,
}) => {
  await page.goto("/top-gear?restore=1");
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const key = "b".repeat(43);
const request = JSON.parse(
  readFileSync("tests/fixtures/auth-report-request.json", "utf8"),
);
const row = {
  id: "row",
  loadout: request.snapshot.equipped,
  dps: 10000,
  gain: 0,
  percent: 0,
  swaps: 0,
  eligible: true,
  isEquipped: true,
  tiedToHighest: true,
  iterations: 1000,
  inputHash: "stable",
};
const report = {
  jobId: "fixture",
  canManage: true,
  access: {
    saved: false,
    canManage: true,
    canSave: true,
    canDelete: false,
    effectiveExpiresAt: "2030-01-01T00:00:00Z",
    anonymousExpiresAt: "2030-01-01T00:00:00Z",
  },
  error: null,
  pinnedRows: [row],
  totalRows: 1,
  nextCursor: null,
  report: {
    snapshot: request.snapshot,
    selection: request.selection,
    rows: [row],
    status: "complete",
    phase: "complete",
    highestId: row.id,
    recommendedId: null,
    equippedId: row.id,
    policy: { iterationsPerSet: 1000 },
    coverage: {
      planned: 1,
      succeeded: 1,
      failed: 0,
      returned: 1,
      exhaustive: true,
    },
    termination: "complete",
    expiresAt: "2030-01-01T00:00:00Z",
  },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/account/session", (route) =>
    route.fulfill({
      json: { account: null, savingEnabled: true, enrollmentEnabled: true },
    }),
  );
  await page.route("**/api/reports/fixture?*", (route) =>
    route.fulfill({ json: report }),
  );
});
test("save dialog uses real report context and fits a 390px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reports/fixture");
  await expect(
    page.getByRole("button", { name: "Save report", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/Parity · Fury Warrior · 10,000 DPS/),
  ).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(358);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".superpowers/sdd/2026-09-10-discord-authentication/task-10-save-mobile.png",
    fullPage: true,
  });
});
test("return removes secrets, retains failed intent through reload and exposes private headers", async ({
  page,
}) => {
  await page.goto("/reports/fixture");
  await page.evaluate(
    (key) =>
      sessionStorage.setItem(
        `munigan.auth.report.${key}`,
        JSON.stringify({
          version: 1,
          expiresAt: Date.now() + 30 * 60 * 1000,
          value: {
            version: 1,
            reportPath: "/reports/fixture",
            locale: "en-US",
            cursor: 0,
            selectedId: "row",
            difference: "equipped",
            scrollY: 0,
          },
        }),
      ),
    key,
  );
  let attempts = 0;
  await page.route("**/api/library/save-intents/complete", (route) => {
    attempts++;
    return route.fulfill({ status: 503, json: { code: "AUTH_UNAVAILABLE" } });
  });
  const response = await page.goto(`/auth/return?intent=${key}&code=secret`);
  await expect(page).toHaveURL(/\/auth\/return$/);
  await expect(page.locator(".auth-return").getByRole("alert")).toContainText(
    "Saving can be retried",
  );
  // Next dev deliberately overwrites this header; production evidence uses the same suite with next start.
  if (process.env.AUTH_CONTROLS_PRODUCTION === "1")
    expect(response!.headers()["cache-control"]).toContain("no-store");
  else
    expect(response!.headers()["cache-control"]).toBe(
      "no-cache, must-revalidate",
    );
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response!.headers()["x-robots-tag"]).toContain("noindex");
  await page.reload();
  await expect(page.locator(".auth-return").getByRole("alert")).toContainText(
    "Saving can be retried",
  );
  expect(attempts).toBe(2);
});

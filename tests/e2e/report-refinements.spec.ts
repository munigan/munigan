import { test, expect, type Page } from "@playwright/test";
import { Stat, Class, Race } from "../../src/generated/wotlk/common";
import type { TopGearReport } from "../../src/domain/top-gear/model";
import { reportFixture } from "../support/report-fixture";
import { readFileSync } from "node:fs";

test("sharing confirms the copied link and allows dismissal and repeated sharing", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openReport(page);
  const share = page.getByRole("button", { name: "Share", exact: true });
  await share.click();
  const toast = page.getByRole("dialog", {
    name: "Report link copied",
    exact: true,
  });
  await expect(toast).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  );
  await share.click();
  await expect(toast).toHaveCount(1);
  await toast.hover();
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toBeHidden();
  await share.click();
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 8000 });
});

test("sharing explains clipboard failures in a toast", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await openReport(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  // Base UI announces high-priority toasts in a separate live region until focused.
  const toast = page
    .locator('[role="alertdialog"]')
    .filter({ hasText: "Couldn’t copy link" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(
    "Try again or copy the address from your browser.",
  );
  await expect(
    page.getByRole("dialog", { name: "Report link copied", exact: true }),
  ).toHaveCount(0);
});

async function openReport(
  page: Page,
  status: TopGearReport["status"] = "complete",
) {
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: reportFixture(status) }),
  );
  await page.goto("/reports/refinements");
}

test("talent contributions appear in compact row tooltips and the stats dialog", async ({
  page,
}, testInfo) => {
  const fixture = reportFixture();
  const presets = JSON.parse(readFileSync("data/wotlk/presets.json", "utf8"));
  const frost = presets.deathknight.variants.find(
    (v: { defaultName: string }) => v.defaultName === "Frost",
  );
  const key = Object.entries(presets.deathknight.presets).find(
    ([, value]) =>
      (value as { data?: { talentsString: string } }).data?.talentsString ===
      frost.talents.talentsString,
  )![0];
  fixture.report.snapshot.specId = `deathknight:${key}`;
  const player = fixture.report.snapshot.settings.player;
  player.name = "Frost talent breakdown";
  player.class = Class.ClassDeathknight;
  player.race = Race.RaceTroll;
  player.talentsString = frost.talents.talentsString;
  delete player.warrior;
  player.deathknight = { options: frost.specOptions };
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/refinements");
  const stat = page
    .locator(".combination-stats > div")
    .filter({ has: page.locator("dt", { hasText: /^Exp$/ }) })
    .first();
  await expect(stat).toHaveAttribute(
    "title",
    /Includes \+5 expertise from Tundra Stalker/,
  );
  await expect(stat.locator("dd")).toContainText("6.50%");
  await expect(stat.locator("dt")).toHaveText("Exp");
  await page.getByRole("button", { name: "Stats details" }).click();
  const dialog = page.getByRole("dialog", { name: "Character stats" });
  await expect(
    dialog.getByText("Includes +5 expertise from Tundra Stalker", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Includes +3% from Nerves of Cold Steel", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Includes +5% from Dark Conviction", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".accuracy-stats")).toContainText(
    "26.00 expertise",
  );
  await page.screenshot({
    path: testInfo.outputPath("talent-stats-desktop.png"),
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(
    dialog.getByText("Includes +5 expertise from Tundra Stalker", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("talent-stats-mobile.png"),
  });
});

test("a recommended tied build is selected by default and explicit selection is retained", async ({
  page,
}) => {
  const fixture = reportFixture();
  fixture.report.recommendedId = "equipped";
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/refinements");
  const recommended = page.locator(".combination-row.equipped-row");
  await expect(recommended).toHaveClass(/selected/);
  await expect(
    recommended.locator(".report-row-badges .recommended-badge"),
  ).toHaveText("Recommended");
  await expect(recommended.locator(".tied-badge")).toHaveCount(0);
  await expect(recommended.locator(".set-changes .badge")).toHaveCount(0);
  await expect(page.locator(".selected-set .eyebrow")).toHaveText(
    "VIEWING RECOMMENDED BUILD",
  );
  await page.getByRole("button", { name: /View set 1,/ }).click();
  await expect(recommended).not.toHaveClass(/selected/);
  await page.getByLabel("Top set", { exact: true }).check();
  await expect(
    page.locator(".combination-row.selected .highest-badge"),
  ).toBeVisible();
});

test("without a qualifying recommendation, the highest DPS remains the default", async ({
  page,
}) => {
  const fixture = reportFixture();
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({
      json: {
        ...fixture,
        report: { ...fixture.report, recommendedId: null },
      },
    }),
  );
  await page.goto("/reports/refinements");
  await expect(page.locator(".recommended-badge")).toHaveCount(0);
  await expect(
    page.locator(".combination-row.selected .highest-badge"),
  ).toBeVisible();
});

test("rows show only gear changes while the summary keeps the full set", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReport(page);
  const selectedRow = page.locator(".combination-row.selected");
  for (const row of await page.locator(".combination-row").all()) {
    await expect(
      row.locator(".gear-strip-compact .gear-slot:not(.changed)"),
    ).toHaveCount(0);
    await expect(
      row.locator(".gear-strip-compact .gear-slot small"),
    ).toHaveCount(0);
  }
  await expect(selectedRow.locator(".gear-slot.changed")).toHaveCount(1);
  await expect(selectedRow.locator(".gear-slot")).toHaveCount(1);
  await expect(page.locator(".combination-row.equipped-row")).toContainText(
    "No gear changes",
  );
  await expect(
    page.getByRole("columnheader", { name: "GEAR CHANGES", exact: true }),
  ).toBeVisible();

  await expect(selectedRow).toHaveCSS("background-color", "rgb(25, 28, 33)");
  await expect(selectedRow).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".equipped-badge")).toHaveCSS(
    "border-color",
    "rgb(73, 76, 83)",
  );
  await selectedRow.hover();
  await expect(selectedRow).toHaveCSS("background-color", "rgb(32, 35, 41)");
  for (const name of ["Changes", "Full set", "Copy set", "View equipped ↓"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  }
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot"),
  ).toHaveCount(17);
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot.changed"),
  ).toHaveCount(1);
  await expect(page.locator(".required-changes")).toHaveText(
    "1 required change vs. equipped",
  );
  const gains = await page
    .locator(".combination-row > .dps-change")
    .allTextContents();
  await page.getByLabel("Top set", { exact: true }).check();
  await expect(selectedRow.locator(".gear-slot")).toHaveCount(0);
  await expect(selectedRow).toContainText("No gear changes");
  await expect(
    page.locator(".combination-row.equipped-row .gear-slot"),
  ).toHaveCount(1);
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot"),
  ).toHaveCount(17);
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot.changed"),
  ).toHaveCount(0);
  await expect(page.locator(".required-changes")).toHaveText(
    "1 required change vs. equipped",
  );
  expect(
    await page.locator(".combination-row > .dps-change").allTextContents(),
  ).toEqual(gains);
  await expect(page.locator(".dps-heading")).toContainText("+50");
  await expect(page.locator(".dps-heading .dps-change-percent")).toHaveText(
    "(+0.50%)",
  );
  await page.getByLabel("Equipped", { exact: true }).check();
  await page.getByRole("button", { name: /View equipped gear,/ }).click();
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot"),
  ).toHaveCount(17);
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot.changed"),
  ).toHaveCount(0);
  await expect(page.locator(".required-changes")).toHaveText(
    "0 required changes vs. equipped",
  );
  await expect(page.locator(".equipped-badge")).toBeVisible();
  await expect(page.locator(".tied-badge")).toHaveAccessibleDescription(
    /sampling uncertainty/,
  );
});

test("each combination shows its own percentages and keeps them when selection changes", async ({
  page,
}) => {
  const fixture = reportFixture();
  fixture.pinnedRows[0].stats = [...fixture.pinnedRows[0].stats!];
  fixture.pinnedRows[0].stats[Stat.StatMeleeHit] = 7 * 32.789989;
  fixture.pinnedRows[0].stats[Stat.StatArmorPenetration] = 699.5;
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/refinements");
  const rows = page.locator(".combination-row");
  const summaries = rows.locator(".combination-stats");
  await expect(summaries).toHaveCount(2);
  await expect(summaries.nth(0)).toContainText("7.00%");
  await expect(summaries.nth(0)).toContainText("50.00%");
  await expect(summaries.nth(1)).toContainText("8.00%");
  await expect(summaries.nth(0).locator('[data-capped="false"] dd')).toHaveCSS(
    "color",
    "rgb(245, 141, 136)",
  );
  const before = await summaries.allTextContents();
  await page.getByRole("button", { name: /View equipped gear,/ }).click();
  expect(await summaries.allTextContents()).toEqual(before);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const summary of await summaries.all()) {
      expect(
        await summary.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
    }
  }
});

test("mobile shows the full set and stats details retain keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openReport(page);
  await expect(page.getByRole("group", { name: "Gear preview" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".selected-set .gear-strip .gear-slot"),
  ).toHaveCount(17);
  await expect(page.getByLabel("Prefer fewer swaps when tied")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Use selected set as a new equipped reference/,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".report-fewer-swaps")).toHaveCount(0);
  await expect(page.locator(".highest-badge")).toBeVisible();
  await expect(page.locator(".equipped-row .tied-badge")).toBeVisible();
  const open = page.getByRole("button", { name: "Stats details" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Character stats" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("table")).toHaveCount(1);
  await expect(
    dialog.getByRole("row", { name: "Strength 1,800", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("row", { name: /Melee Crit rating 450.5/ }),
  ).toBeVisible();
  await expect(dialog.locator(".full-gear-row, [data-item-icon]")).toHaveCount(
    0,
  );
  await expect(dialog.locator(".accuracy-stats")).toContainText("8.00% hit");
  await expect(dialog.locator(".accuracy-stats")).toContainText(
    "26.00 expertise",
  );
  await expect(
    dialog.locator('.accuracy-stat[data-capped="true"]'),
  ).toHaveCount(2);
  await expect(dialog.locator(".accuracy-status").first()).toContainText(
    "At cap",
  );
  await expect(dialog.locator(".accuracy-status").first()).toHaveCSS(
    "color",
    "rgb(120, 227, 77)",
  );
  await expect(
    dialog
      .getByRole("row", { name: /Armor Penetration rating/ })
      .locator(".stat-percentage"),
  ).toHaveText("0.00%");
  await expect(
    dialog.getByRole("rowheader", {
      name: /Intellect|Spirit|Ranged Attack Power/,
    }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("table")).toHaveCount(1);
  await expect(dialog.locator("details, thead")).toHaveCount(0);
  await expect(
    dialog.getByRole("row", { name: "Armor 12,345", exact: true }),
  ).toHaveCount(0);
  for (const label of ["Strength", "Agility", "Armor Penetration rating"]) {
    await expect(
      dialog.getByRole("rowheader", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(
    dialog.getByRole("rowheader", { name: /Spell Crit|Spell Haste/ }),
  ).toHaveCount(0);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await dialog.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const strip of await page.locator(".gear-strip-compact").all()) {
      expect(
        await strip.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
    }
    const heights = await page
      .locator(".combination-row")
      .evaluateAll((rows) =>
        rows.map((row) => row.getBoundingClientRect().height),
      );
    expect(new Set(heights).size, `Row heights at ${width}px: ${heights}`).toBe(
      1,
    );
  }
});

test("desktop stats put cap percentages above the primary metrics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReport(page);
  await page.getByRole("button", { name: "Stats details" }).click();
  const dialog = page.getByRole("dialog", { name: "Character stats" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBe(1120);
  const primary = await dialog.locator(".stats-primary").boundingBox();
  const accuracy = await dialog.locator(".stats-accuracy").boundingBox();
  expect(primary!.y).toBeGreaterThan(accuracy!.y + accuracy!.height);
  const caps = await dialog.locator(".accuracy-stat").all();
  expect((await caps[0].boundingBox())!.y).toBe(
    (await caps[1].boundingBox())!.y,
  );
  await expect(dialog.locator(".accuracy-value strong").first()).toHaveText(
    "8.00%",
  );
  await expect(dialog.locator(".stats-primary .stat-icon")).toHaveCount(6);
  await expect(dialog.locator("details, thead")).toHaveCount(0);
  await expect(dialog.locator(".stats-cap-note")).toContainText(
    "Level 83 target",
  );
});

test("caster primary stats show spell offense without melee or secondary stats", async ({
  page,
}) => {
  const fixture = reportFixture();
  fixture.report.snapshot.specId = "mage:FireTalents";
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/reports/refinements");
  await page.getByRole("button", { name: "Stats details" }).click();
  const dialog = page.getByRole("dialog", { name: "Character stats" });
  for (const label of [
    "Spell Power",
    "Spell Crit rating",
    "Spell Haste rating",
    "Intellect",
    "Spirit",
  ]) {
    await expect(
      dialog.getByRole("rowheader", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(
    dialog.getByRole("rowheader", {
      name: /Melee|Armor|Attack Power|Health|Mana|Resistance|Defense/,
    }),
  ).toHaveCount(0);
  await expect(dialog.locator("details, thead")).toHaveCount(0);
  await expect(dialog.locator(".accuracy-stats")).toContainText("Spell hit");
  await expect(
    dialog.locator('.accuracy-stat[data-capped="false"]'),
  ).toHaveCount(1);
  await expect(dialog.locator(".accuracy-status")).toContainText("below cap");
  await expect(dialog.locator(".accuracy-status")).toHaveCSS(
    "color",
    "rgb(245, 141, 136)",
  );
  await expect(dialog.locator(".accuracy-stats")).not.toContainText(
    "Expertise",
  );
});

for (const [status, heading, action] of [
  ["queued", "Your run is in the queue", "Cancel run"],
  ["running", "Comparing complete combinations", "Cancel run"],
  ["partial", "Partial results", "Retry unfinished work"],
  ["failed", "This run could not finish", "Retry unfinished work"],
  ["canceled", "Run canceled", "Retry unfinished work"],
] as const) {
  test(`${status} report presents progress and existing management action`, async ({
    page,
  }) => {
    await openReport(page, status);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: action })).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ has: page.getByRole("heading", { name: heading }) }),
    ).toContainText(status === "failed" ? "Worker unavailable." : "sets");
  });
}

test("pagination retains the report and scroll position while the next page loads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = reportFixture();
  const first = {
    ...fixture,
    totalRows: 40,
    nextCursor: 20,
    report: {
      ...fixture.report,
      rows: [
        fixture.report.rows[0],
        {
          ...fixture.report.rows[1],
          id: "page-only",
          isEquipped: false,
          dps: 9000,
        },
      ],
    },
  };
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/api/reports/refinements?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("cursor") === "20") {
      requested = true;
      await delayed;
      await route.fulfill({
        json: {
          ...fixture,
          totalRows: 40,
          nextCursor: null,
          report: {
            ...fixture.report,
            rows: fixture.report.rows.map((row) => ({
              ...row,
              id: `next-${row.id}`,
            })),
          },
        },
      });
    } else await route.fulfill({ json: first });
  });
  await page.goto("/reports/refinements");
  await page
    .getByRole("button", { name: "View set 2, 9,000 DPS", exact: true })
    .click();
  const selectedDps = await page.locator(".dps-heading > strong").textContent();
  await page
    .getByRole("button", { name: "Next", exact: true })
    .scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  const table = page.getByRole("table", { name: "Ranked gear combinations" });
  const firstLabel = await table
    .getByRole("button")
    .first()
    .getAttribute("aria-label");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  try {
    await expect(table).toBeVisible();
    await expect(table.getByRole("button").first()).toHaveAttribute(
      "aria-label",
      firstLabel!,
    );
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
  } finally {
    release();
  }
  await expect(table.getByRole("button").first()).toHaveAttribute(
    "aria-label",
    /View set 21,/,
  );
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(page.locator(".dps-heading > strong")).toHaveText(selectedDps!);
});

test("full pages have equal result counts and row heights with or without badges", async ({
  page,
}) => {
  const fixture = reportFixture();
  fixture.report.recommendedId = fixture.report.highestId;
  const rows = Array.from({ length: 40 }, (_, index) =>
    index < 2
      ? fixture.report.rows[index]
      : {
          ...fixture.report.rows[0],
          id: `set-${index}`,
          tiedToHighest: false,
        },
  );
  await page.route("**/api/reports/refinements?*", (route) => {
    const cursor = Number(
      new URL(route.request().url()).searchParams.get("cursor") || 0,
    );
    return route.fulfill({
      json: {
        ...fixture,
        totalRows: 40,
        nextCursor: cursor === 0 ? 20 : null,
        report: { ...fixture.report, rows: rows.slice(cursor, cursor + 20) },
      },
    });
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/reports/refinements");
    await expect(page.locator(".combination-row")).toHaveCount(20);
    const firstHeight = (await page
      .locator(".combination-table")
      .boundingBox())!.height;
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: /Pagination|Paginação/ }),
    ).toContainText("21–40 of 40");
    await expect(page.locator(".combination-row")).toHaveCount(20);
    const nextHeight = (await page.locator(".combination-table").boundingBox())!
      .height;
    expect(nextHeight, `Table heights at ${width}px`).toBe(firstHeight);
  }
});

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { slots } from "../../src/domain/top-gear/slots";
import type {
  ItemInstance,
  Loadout,
  SetRow,
  TopGearReport,
} from "../../src/domain/top-gear/model";

function reportFixture(status: TopGearReport["status"] = "complete") {
  const sim = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const player = sim.raid.parties[0].players[0];
  const inventory: ItemInstance[] = player.equipment.items.map(
    (
      item: { id: number; enchant?: number; gems?: number[] },
      index: number,
    ) => ({
      instanceId: `equipped-${index}`,
      itemId: item.id,
      enchantId: item.enchant ?? 0,
      gemIds: item.gems ?? [],
      source: "equipped",
      equippedSlot: slots[index],
    }),
  );
  const snapshot = {
    id: "report-snapshot",
    specId: "warrior:FuryTalents",
    itemVersion: "classic",
    inventory,
    equipped: Object.fromEntries(
      slots.map((slot, index) => [slot, inventory[index].instanceId]),
    ) as Loadout,
    settings: {
      player: { ...player, name: "Report preview" },
      encounter: sim.encounter,
    },
    provenance: {},
    versions: {
      engine: "fixture",
      schema: "fixture",
      catalog: "fixture",
      presets: "fixture",
      optimizer: "fixture",
    },
  };
  snapshot.inventory.push({
    instanceId: "candidate-head",
    itemId: 40528,
    enchantId: 3817,
    gemIds: [41285, 40111],
    source: "bag",
  });
  const equipped: SetRow = {
    id: "equipped",
    loadout: snapshot.equipped,
    dps: 10000,
    gain: 0,
    percent: 0,
    swaps: 0,
    eligible: true,
    isEquipped: true,
    tiedToHighest: true,
    iterations: 1000,
    inputHash: "equipped",
    stats: [],
  };
  const highest: SetRow = {
    ...equipped,
    id: "highest",
    inputHash: "highest",
    loadout: { ...snapshot.equipped, head: "candidate-head" },
    dps: 10050,
    gain: 50,
    percent: 0.5,
    swaps: 1,
    isEquipped: false,
  };
  const rows =
    status === "queued" || status === "failed" ? [] : [highest, equipped];
  return {
    jobId: "report-fixture",
    canManage: true,
    error: status === "failed" ? "Worker unavailable." : null,
    pinnedRows: rows,
    totalRows: rows.length,
    nextCursor: null,
    report: {
      token: "refinements",
      snapshot,
      selection: {
        selectedInstanceIds: inventory.map((item) => item.instanceId),
        lockedSlots: {},
        acknowledgedExclusions: [],
      },
      status,
      phase: status === "queued" ? "planning" : "combinations",
      policy: { iterationsPerSet: 1000 },
      rows,
      equippedId: equipped.id,
      highestId: highest.id,
      recommendedId: equipped.id,
      coverage: {
        planned: 2,
        succeeded: rows.length,
        failed: status === "failed" ? 1 : 0,
        returned: rows.length,
        exhaustive: status === "complete",
      },
      termination: status === "partial" ? "runtime-limit" : status,
      expiresAt: "2030-01-01T00:00:00Z",
    },
  };
}

async function openReport(
  page: Page,
  status: TopGearReport["status"] = "complete",
) {
  await page.route("**/api/reports/refinements?*", (route) =>
    route.fulfill({ json: reportFixture(status) }),
  );
  await page.goto("/reports/refinements");
}

test("desktop preview toggles complete set and changes without changing equipped gains", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReport(page);
  await expect(
    page.getByRole("button", { name: "Full set", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gear-strip .gear-slot")).toHaveCount(17);
  await page.getByRole("button", { name: "Changes", exact: true }).click();
  await expect(page.locator(".gear-strip .gear-slot")).toHaveCount(1);
  await expect(page.locator(".required-changes")).toHaveText(
    "1 required change vs. equipped",
  );
  const gains = await page
    .locator(".combination-row > .dps-change")
    .allTextContents();
  await page.getByLabel("Top set", { exact: true }).check();
  await expect(page.locator(".gear-strip .gear-slot")).toHaveCount(0);
  await expect(
    page.getByText("Matches the top set", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".required-changes")).toHaveText(
    "1 required change vs. equipped",
  );
  expect(
    await page.locator(".combination-row > .dps-change").allTextContents(),
  ).toEqual(gains);
  await expect(page.locator(".dps-heading")).toContainText("+50");
  await page.getByLabel("Equipped", { exact: true }).check();
  await page.getByRole("button", { name: /View equipped ↓/ }).click();
  await expect(
    page.getByText("No changes from equipped", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".required-changes")).toHaveText(
    "0 required changes vs. equipped",
  );
  await expect(page.locator(".equipped-badge")).toBeVisible();
  await expect(page.locator(".tied-badge")).toHaveAccessibleDescription(
    /sampling uncertainty/,
  );
});

test("mobile defaults to changes and full details retain enhancements and keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openReport(page);
  await expect(
    page.getByRole("button", { name: "Changes", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gear-strip .gear-slot")).toHaveCount(1);
  const recommendation = page.locator(".equipped-row .report-fewer-swaps");
  await expect(recommendation).toBeVisible();
  await expect(recommendation).toHaveText("Fewer swaps");
  await expect(page.locator(".highest-badge")).toBeVisible();
  await page.getByLabel("Prefer fewer swaps when tied").uncheck();
  await expect(recommendation).toHaveCount(0);
  await expect(page.locator(".equipped-row .tied-badge")).toBeVisible();
  await page.getByLabel("Prefer fewer swaps when tied").check();
  await expect(recommendation).toBeVisible();
  await page.getByRole("button", { name: "Full set", exact: true }).click();
  await expect(page.locator(".gear-strip .gear-slot")).toHaveCount(17);
  const open = page.getByRole("button", { name: "Full gear details" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: /Full gear/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".full-gear-row")).toHaveCount(17);
  const head = dialog.locator(".full-gear-row").first();
  await expect(head.locator(".full-gear-enhancements")).toContainText(
    "Arcanum of Torment",
  );
  await expect(
    head.locator(".full-gear-enhancements a[data-wowhead]"),
  ).toHaveCount(2);
  await expect(head.locator("a[data-wowhead]").first()).toHaveAttribute(
    "data-wowhead",
    "ench=3817&gems=41285:40111",
  );
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
    const heights = await page
      .locator(".combination-row")
      .evaluateAll((rows) =>
        rows.map((row) => row.getBoundingClientRect().height),
      );
    expect(new Set(heights).size).toBe(1);
  }
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
    await expect(page.locator(".report-state")).toContainText(
      status === "failed" ? "Worker unavailable." : "sets",
    );
  });
}

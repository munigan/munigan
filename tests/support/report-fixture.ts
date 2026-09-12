import versions from "../../data/wotlk/versions.json" with { type: "json" };
import type {
  AcquisitionStep,
  PurchaseInputs,
  PurchaseRecipe,
} from "../../src/domain/purchases/model";
import { readFileSync } from "node:fs";
import { slots } from "../../src/domain/top-gear/slots";
import { Stat } from "../../src/generated/wotlk/common";
import type {
  ItemInstance,
  Loadout,
  SetRow,
  TopGearReport,
} from "../../src/domain/top-gear/model";
export function reportFixture(status: TopGearReport["status"] = "complete") {
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
    stats: Array.from(
      { length: 40 },
      (_, index) =>
        ({
          [Stat.StatStrength]: 1800,
          [Stat.StatMeleeCrit]: 450.5,
          [Stat.StatMeleeHit]: 262.319912,
          [Stat.StatExpertise]: 213.134896,
          [Stat.StatArmor]: 12345,
        })[index] ?? 0,
    ),
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
    access: {
      saved: false,
      canManage: true,
      canSave: true,
      canDelete: false,
      effectiveExpiresAt: "2030-01-01T00:00:00Z",
      anonymousExpiresAt: "2030-01-01T00:00:00Z",
    },
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
      recommendedId: null as string | null,
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

/** Two explicit plans exercise report selection independently of live repricing. */
export function purchaseReportFixture() {
  const catalog = JSON.parse(
    readFileSync("data/wotlk/purchases.json", "utf8"),
  ) as { revision: string; recipes: PurchaseRecipe[] };
  const fixture = reportFixture();
  fixture.report.snapshot.versions = versions;
  const originalSnapshot = structuredClone(fixture.report.snapshot);
  const inputs: PurchaseInputs = {
    version: 1,
    recipeRevision: catalog.revision,
    balances: { frost: 100, "mark:normal:protector": 1 },
    excludedItemIds: { original: [50080] },
    itemEnhancements: { classic: { "51210": { enchantId: 3808 } } },
  };
  const recipes = catalog.recipes.filter((r) =>
    [50082, 51210].includes(r.itemId),
  );
  const step = (itemId: number): AcquisitionStep => ({
    recipeId: recipes.find((r) => r.itemId === itemId)!.id,
    itemId,
    resultId: `purchase-classic-${itemId}`,
    cost: { ...recipes.find((r) => r.itemId === itemId)!.cost },
  });
  const base = step(50082);
  const upgraded = {
    ...step(51210),
    prerequisite: { itemId: 50082, stepId: base.resultId },
  };
  const baseline = {
    ...fixture.report.rows[1],
    purchasePlan: {
      steps: [],
      spent: {},
      remaining: { ...inputs.balances },
      consumedInstanceIds: [],
    },
  };
  const highest: SetRow = {
    ...fixture.report.rows[0],
    loadout: { ...originalSnapshot.equipped, shoulder: upgraded.resultId },
    purchasePlan: {
      steps: [base, upgraded],
      spent: { frost: 60, "mark:normal:protector": 1 },
      remaining: { frost: 40, "mark:normal:protector": 0 },
      consumedInstanceIds: [],
    },
  };
  const alternative: SetRow = {
    ...highest,
    id: "base-only",
    inputHash: "base-only",
    dps: 10025,
    gain: 25,
    percent: 0.25,
    tiedToHighest: false,
    loadout: { ...originalSnapshot.equipped, shoulder: base.resultId },
    purchasePlan: {
      steps: [base],
      spent: { frost: 60 },
      remaining: { frost: 40, "mark:normal:protector": 1 },
      consumedInstanceIds: [],
    },
  };
  const rows = [highest, alternative, baseline];
  fixture.report.snapshot.inventory.push(
    ...[base, upgraded].map((s) => ({
      instanceId: s.resultId,
      itemId: s.itemId,
      source: "purchase" as const,
      gemIds: [],
      enchantId: 0,
    })),
  );
  return {
    ...fixture,
    pinnedRows: [highest, baseline],
    totalRows: 3,
    report: {
      ...fixture.report,
      rows,
      coverage: {
        ...fixture.report.coverage,
        planned: 3,
        succeeded: 3,
        returned: 3,
      },
      purchases: {
        inputs,
        recipeRevision: inputs.recipeRevision,
        originalSnapshot,
        recipes,
      },
    },
  };
}

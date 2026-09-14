import { expect, it } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import {
  estimateAllowance,
  loadoutKey,
  planRun,
} from "@/domain/equipment/enumerate";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { preparePurchases } from "./candidates";
import { analyzePurchaseSelection } from "./analysis";
import { PurchaseEnhancementError } from "./enhancements";
import { itemVersions } from "@/domain/top-gear/item-version";
import { getPurchaseCatalog } from "./catalog";
import type { PreparedPurchases } from "./model";

it("counts exactly 31 affordable sets instead of the 243 raw combinations", () => {
  const request = purchaseFixture({ frost: 100, "regalia:vanquisher": 1 });
  const policy = {
    ...purchasePolicy,
    maxUnits: 31 * purchasePolicy.unitsPerSet,
  };
  const prepared = preparePurchases(request, createSearchBudget(100000));
  expect(
    estimateAllowance(prepared.snapshot, prepared.selection, policy).count,
  ).toBe(243);
  const result = analyzePurchaseSelection(request, policy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.allowance).toMatchObject({
    count: 31,
    allowed: true,
    countKind: "exact",
  });
  expect(result.plan.simulations).toHaveLength(31);
  expect(new Set(result.plan.simulations.map((s) => s.key)).size).toBe(31);
  expect(result.plan.simulations.filter((s) => s.isReference)).toHaveLength(1);
  expect(result.visitedNodes).toBeLessThanOrEqual(policy.maxSearchNodes!);
  const over = analyzePurchaseSelection(request, {
    ...policy,
    maxUnits: 30 * policy.unitsPerSet,
  });
  expect(over).toMatchObject({
    status: "over-limit",
    allowance: { count: 31, countKind: "over-limit", allowed: false },
  });
});

it.each([
  [100, 6, false],
  [120, 7, true],
] as const)(
  "respects a %s Frost wallet across both 60-Frost slots",
  (frost, count, pair) => {
    const result = analyzePurchaseSelection(
      purchaseFixture({ frost }),
      purchasePolicy,
    );
    expect(result.status).toBe("complete");
    if (result.status !== "complete") throw new Error(result.status);
    const plans = Object.values(result.plan.purchases!.plansByLoadoutKey);
    expect(result.plan.simulations).toHaveLength(count);
    expect(plans.some((p) => p.spent.frost === 60)).toBe(true);
    expect(plans.some((p) => p.spent.frost === 120)).toBe(pair);
    expect(plans.every((p) => (p.spent.frost ?? 0) <= frost)).toBe(true);
  },
);

it("keeps zero spend and the legacy baseline seed, keys and ordering", () => {
  const request = purchaseFixture({ frost: 0 });
  const legacy = planRun(request.snapshot, request.selection, purchasePolicy);
  const result = analyzePurchaseSelection(request, purchasePolicy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.simulations).toEqual(legacy.simulations);
  expect(
    result.plan.purchases!.plansByLoadoutKey[result.plan.simulations[0].key],
  ).toEqual({
    steps: [],
    spent: {},
    remaining: { frost: 0 },
    consumedInstanceIds: [],
  });
});

it("returns no legal sets when an unavailable reward is locked, despite the reference", () => {
  const request = purchaseFixture({ frost: 0 });
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    gemIds: [],
    enchantId: 0,
    source: "custom",
  });
  request.selection.selectedInstanceIds.push("custom");
  request.selection.lockedSlots.shoulder = "custom";
  expect(analyzePurchaseSelection(request, purchasePolicy).status).toBe(
    "no-legal-sets",
  );
});

it("stops at the exact shared search bound and distinguishes stale catalogs and data errors", () => {
  const request = purchaseFixture({ frost: 100, "regalia:vanquisher": 1 });
  for (const maxSearchNodes of [0, 1, 100, 1000]) {
    expect(
      analyzePurchaseSelection(request, { ...purchasePolicy, maxSearchNodes }),
    ).toMatchObject({
      status: "search-limit",
      visitedNodes: maxSearchNodes,
    });
  }
  request.purchases!.recipeRevision = "old";
  expect(analyzePurchaseSelection(request, purchasePolicy)).toMatchObject({
    status: "catalog-changed",
  });
  const invalid = purchaseFixture({ frost: 100 });
  invalid.purchases!.itemEnhancements.original = {
    "50098": { enchantId: 3839 },
  };
  expect(() => analyzePurchaseSelection(invalid, purchasePolicy)).toThrow(
    PurchaseEnhancementError,
  );
});

it("keeps the raw baseline separate from modified owned enhancements", () => {
  const request = purchaseFixture({ frost: 0 });
  request.snapshot.itemEnhancements = { "owned-legs": { gemIds: [40111] } };
  const result = analyzePurchaseSelection(request, purchasePolicy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.simulations).toHaveLength(2);
  expect(result.plan.simulations[0]).toMatchObject({
    key: loadoutKey(request.snapshot, request.snapshot.equipped, true),
    seed: "100000",
    iterations: 20,
    isReference: true,
  });
  expect(result.plan.simulations[1]).toMatchObject({
    seed: "100021",
    iterations: 20,
    isReference: false,
  });
});

it("retains candidate eligibility when an unedited duplicate matches an overridden reference's raw key", () => {
  const request = purchaseFixture({ frost: 0 });
  request.snapshot.inventory.push({
    ...request.snapshot.inventory[0],
    instanceId: "duplicate-legs",
    source: "bag",
    equippedSlot: undefined,
  });
  request.selection.selectedInstanceIds.push("duplicate-legs");
  request.snapshot.itemEnhancements = { "owned-legs": { gemIds: [40111] } };
  const result = analyzePurchaseSelection(request, purchasePolicy);
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.simulations).toHaveLength(2);
  expect(result.plan.simulations[0].loadout.legs).toBe("owned-legs");
  expect(result.plan.candidateLoadouts.map((l) => l.legs)).toEqual([
    "owned-legs",
    "duplicate-legs",
  ]);
  expect(
    new Set(
      result.plan.candidateLoadouts.map((l) => loadoutKey(request.snapshot, l)),
    ).size,
  ).toBe(2);
  expect(
    result.plan.purchases!.plansByLoadoutKey[result.plan.simulations[0].key]
      .spent,
  ).toEqual({});
});

it("deduplicates duplicate owned upgrade paths while retaining a valid consumed instance explanation", () => {
  const request = purchaseFixture({ frost: 0, "mark:normal:vanquisher": 1 });
  for (const id of ["z-shoulder", "a-shoulder"])
    request.snapshot.inventory.push({
      instanceId: id,
      itemId: 50098,
      gemIds: [],
      enchantId: 0,
      source: "bag",
    });
  request.selection.selectedInstanceIds.push("z-shoulder", "a-shoulder");
  const result = analyzePurchaseSelection(request, purchasePolicy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.simulations).toHaveLength(3);
  const upgrade = result.plan.simulations.find(
    (s) => s.loadout.shoulder === "purchase-original-51125",
  )!;
  expect(result.plan.purchases!.plansByLoadoutKey[upgrade.key]).toMatchObject({
    consumedInstanceIds: ["a-shoulder"],
    spent: { "mark:normal:vanquisher": 1 },
  });
  expect(Object.values(upgrade.loadout)).not.toContain("a-shoulder");
});

it.each(["original", "classic"] as const)(
  "chooses owned gear over an identical paid reward and returns one prepared preview in %s",
  (profile) => {
    const request = purchaseFixture({ frost: 60 });
    request.snapshot.itemVersion = profile;
    request.snapshot.itemDataRevision = itemVersions[profile].revision;
    request.purchases!.recipeRevision = getPurchaseCatalog(profile).revision;
    request.snapshot.inventory.push({
      instanceId: "owned-shoulder",
      itemId: 50098,
      gemIds: [],
      enchantId: 0,
      source: "bag",
    });
    request.selection.selectedInstanceIds.push("owned-shoulder");
    const previews: PreparedPurchases[] = [];
    const result = analyzePurchaseSelection(
      request,
      purchasePolicy,
      (prepared) => previews.push(prepared),
    );
    if (result.status !== "complete") throw new Error(result.status);
    expect(previews).toHaveLength(1);
    expect(
      previews[0].candidates.find((c) => c.instance.itemId === 50098),
    ).toBeUndefined();
    const shoulder = result.plan.simulations.find(
      (s) =>
        s.loadout.shoulder === "owned-shoulder" && s.loadout.hands === null,
    )!;
    expect(shoulder).toBeDefined();
    expect(
      result.plan.purchases!.plansByLoadoutKey[shoulder.key],
    ).toMatchObject({ steps: [], spent: {}, remaining: { frost: 60 } });
    expect(
      result.plan.simulations.some(
        (s) => s.loadout.shoulder === `purchase-${profile}-50098`,
      ),
    ).toBe(false);
    expect(
      result.plan.candidateLoadouts.some(
        (l) => l.shoulder === `purchase-${profile}-50098`,
      ),
    ).toBe(false);
  },
);

it("excludes only actual conflicting gem sets and reports no legal sets when all alternatives conflict", () => {
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.itemEnhancements = { "owned-legs": { gemIds: [49110] } };
  request.purchases!.itemEnhancements.original = {
    "50098": { gemIds: [49110] },
  };
  const result = analyzePurchaseSelection(request, purchasePolicy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.excludedByEnhancements).toBe(1);
  expect(
    result.diagnostics.some((d) => d.message.includes("Unique gem conflict")),
  ).toBe(true);
  expect(
    result.plan.simulations.some(
      (s) => s.loadout.shoulder === "purchase-original-50098",
    ),
  ).toBe(false);
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom");
  request.selection.lockedSlots.shoulder = "custom";
  expect(analyzePurchaseSelection(request, purchasePolicy)).toMatchObject({
    status: "no-legal-sets",
    diagnostics: [expect.objectContaining({ code: "invalid-loadout" })],
  });
});

it("bounds many duplicate physical choices and completes at the exact measured node count", () => {
  const request = purchaseFixture({ frost: 100, "regalia:vanquisher": 1 });
  for (let i = 0; i < 100; i++) {
    const id = `legs-${i}`;
    request.snapshot.inventory.push({
      ...request.snapshot.inventory[0],
      instanceId: id,
      source: "bag",
      equippedSlot: undefined,
    });
    request.selection.selectedInstanceIds.push(id);
  }
  const limited = analyzePurchaseSelection(request, {
    ...purchasePolicy,
    maxSearchNodes: 3000,
  });
  expect(limited).toMatchObject({ status: "search-limit", visitedNodes: 3000 });
  const simple = purchaseFixture({ frost: 0 });
  const complete = analyzePurchaseSelection(simple, purchasePolicy);
  if (complete.status !== "complete") throw new Error(complete.status);
  expect(
    analyzePurchaseSelection(simple, {
      ...purchasePolicy,
      maxSearchNodes: complete.visitedNodes,
    }).status,
  ).toBe("complete");
  expect(
    analyzePurchaseSelection(simple, {
      ...purchasePolicy,
      maxSearchNodes: complete.visitedNodes - 1,
    }),
  ).toMatchObject({
    status: "search-limit",
    visitedNodes: complete.visitedNodes - 1,
  });
});

it("finishes an uncapped purchase search beyond the normal 120-set allowance", () => {
  const result = analyzePurchaseSelection(
    purchaseFixture({ frost: 1000, "regalia:vanquisher": 5 }),
    {
      ...purchasePolicy,
      maxUnits: null,
      maxSearchNodes: null,
      iterationsPerSet: 6000,
    },
  );
  if (result.status !== "complete") throw new Error(result.status);
  expect(result.plan.simulations.length).toBeGreaterThan(120);
  expect(result.plan.allowance.allowed).toBe(true);
  expect(result.plan.simulations.every((s) => s.iterations === 6000)).toBe(
    true,
  );
});

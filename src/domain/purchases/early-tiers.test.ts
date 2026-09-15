import { expect, it } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { getPurchaseCatalog } from "./catalog";
import { preparePurchases } from "./candidates";
import { acquisitionPaths } from "./acquisition";
import { createSearchBudget } from "../equipment/search-budget";
import { analyzePurchaseSelection } from "./analysis";

it.each(["original", "classic"] as const)(
  "supports correct early tier item levels in %s",
  (profile) => {
    const c = getPurchaseCatalog(profile);
    expect(
      new Set(c.recipes.filter((r) => r.tier === 8).map((r) => r.itemLevel)),
    ).toEqual(new Set(profile === "classic" ? [225, 232] : [219, 226]));
    expect(
      new Set(c.recipes.filter((r) => r.tier === 7).map((r) => r.itemLevel)),
    ).toEqual(new Set([200, 213]));
  },
);
it("accepts a slot-specific token OR emblems, and cannot spend one balance twice", () => {
  const r = purchaseFixture({ heroism: 80, "tier:7:10:chest:vanquisher": 1 });
  const p = preparePurchases(r, createSearchBudget(100000));
  const chest = getPurchaseCatalog("original").recipes.find(
    (x) =>
      x.tier === 7 &&
      x.itemLevel === 200 &&
      x.slot === "chest" &&
      x.setVariant === "dk-dps",
  )!;
  const hands = getPurchaseCatalog("original").recipes.find(
    (x) =>
      x.tier === 7 &&
      x.itemLevel === 200 &&
      x.slot === "hands" &&
      x.setVariant === "dk-dps",
  )!;
  const one = acquisitionPaths(
    p,
    [{ itemId: chest.itemId, resultId: "chest" }],
    new Set(),
    createSearchBudget(100000),
  );
  expect(one.some((x) => x.spent.heroism === 80)).toBe(true);
  expect(one.some((x) => x.spent["tier:7:10:chest:vanquisher"] === 1)).toBe(
    true,
  );
  const both = acquisitionPaths(
    p,
    [
      { itemId: chest.itemId, resultId: "chest" },
      { itemId: hands.itemId, resultId: "hands" },
    ],
    new Set(),
    createSearchBudget(100000),
  );
  expect(both.length).toBeGreaterThan(0);
  expect(
    both.every(
      (x) =>
        x.spent.heroism === 60 && x.spent["tier:7:10:chest:vanquisher"] === 1,
    ),
  ).toBe(true);
});
it("counts all combinations after exceeding the free limit", () => {
  const r = purchaseFixture({ frost: 500, "mark:normal:vanquisher": 5 });
  const full = analyzePurchaseSelection(r, {
    ...purchasePolicy,
    maxUnits: null,
    maxSearchNodes: null,
  });
  expect(full.status).toBe("complete");
  const limited = analyzePurchaseSelection(r, {
    ...purchasePolicy,
    maxUnits: purchasePolicy.unitsPerSet * 120,
    maxSearchNodes: null,
  });
  expect(limited.status).toBe("over-limit");
  if (full.status !== "complete" || limited.status !== "over-limit")
    throw new Error("unexpected result");
  expect(limited.allowance.count).toBe(full.plan.allowance.count);
  expect(limited.allowance.countKind).toBe("exact");
  expect(limited.allowance.count).toBe(243);
});

it("cannot redeem a token for another slot or tier", () => {
  const request = purchaseFixture({ "tier:7:10:hands:vanquisher": 1 });
  const prepared = preparePurchases(request, createSearchBudget(100000));
  const available = prepared.candidates.filter((c) => c.available);
  expect(available).toHaveLength(1);
  const recipe = prepared.catalog.byItemId.get(available[0].instance.itemId)!;
  expect(recipe.tier).toBe(7);
  expect(recipe.slot).toBe("hands");
  expect(recipe.itemLevel).toBe(200);
});

it("Conquest buys only T8 head and chest with a shared 58-emblem balance", () => {
  const request = purchaseFixture({ conquest: 58 });
  const prepared = preparePurchases(request, createSearchBudget(100000));
  const available = prepared.candidates.filter((c) => c.available);
  expect(available).toHaveLength(2);
  expect(
    new Set(
      available.map(
        (c) => prepared.catalog.byItemId.get(c.instance.itemId)!.slot,
      ),
    ),
  ).toEqual(new Set(["head", "chest"]));
  const both = acquisitionPaths(
    prepared,
    available.map((c) => ({
      itemId: c.instance.itemId,
      resultId: c.instance.instanceId,
    })),
    new Set(),
    createSearchBudget(100000),
  );
  expect(both).toHaveLength(0);
});

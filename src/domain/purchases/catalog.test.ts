import { expect, it } from "vitest";
import { getPurchaseCatalog, tokenFamilyForClass } from "./catalog";
it.each(["original", "classic"] as const)(
  "keeps exact DK shoulder chains in %s",
  (v) => {
    const c = getPurchaseCatalog(v);
    expect(c.byItemId.get(50098)?.cost).toEqual({ frost: 60 });
    expect(c.byItemId.get(51125)?.prerequisiteItemId).toBe(50098);
    expect(c.byItemId.get(51314)?.prerequisiteItemId).toBe(51125);
    expect(c.byItemId.get(51130)?.prerequisiteItemId).toBe(50853);
    expect(c.byItemId.get(51309)?.prerequisiteItemId).toBe(51130);
    expect(c.byItemId.get(48494)?.cost).toEqual({ "regalia:vanquisher": 1 });
    expect(c.byItemId.get(48494)?.prerequisiteItemId).toBeUndefined();
    expect(tokenFamilyForClass(10)).toBe("vanquisher");
  },
);
it("rejects unsupported classes", () => {
  expect(() => tokenFamilyForClass(0)).toThrow();
  expect(() => tokenFamilyForClass(11)).toThrow();
});

import manifest from "../../../data/wotlk/purchases.json";
import { createPurchaseCatalog, normalizedPurchaseManifest } from "./catalog";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import type { PurchaseManifest } from "./catalog";
import { getCatalog } from "@/domain/equipment/catalog";

const copy = () => structuredClone(manifest) as PurchaseManifest;
it.each(["original", "classic"] as const)(
  "covers every registered variant, faction, slot and quality in %s",
  (profile) => {
    const catalog = getPurchaseCatalog(profile);
    expect(catalog.recipes).toHaveLength(1235);
    expect(new Set(catalog.recipes.map((r) => r.setVariant)).size).toBe(19);
    for (const group of manifest.sets) {
      const recipes = catalog.recipes.filter(
        (r) =>
          r.tier === group.tier &&
          r.setVariant === group.setVariant &&
          r.faction === group.faction,
      );
      const levels =
        group.tier === 7
          ? [200, 213]
          : group.tier === 8
            ? profile === "classic"
              ? [225, 232]
              : [219, 226]
            : group.tier === 9
              ? [232, 245, 258]
              : [251, 264, 277];
      for (const level of levels) {
        expect(
          recipes
            .filter((r) => r.itemLevel === level)
            .map((r) => r.slot)
            .sort(),
        ).toEqual(["chest", "hands", "head", "legs", "shoulder"]);
      }
    }
    for (const recipe of catalog.recipes) {
      const family = tokenFamilyForClass(recipe.classId);
      expect(
        Object.keys(recipe.cost).every(
          (key) => !key.includes(":") || key.endsWith(`:${family}`),
        ),
      ).toBe(true);
      if (recipe.tier === 9) expect(recipe.prerequisiteItemId).toBeUndefined();
      if (recipe.prerequisiteItemId) {
        const previous = catalog.byItemId.get(recipe.prerequisiteItemId)!;
        expect(previous.setVariant).toBe(recipe.setVariant);
        expect(previous.slot).toBe(recipe.slot);
        expect(previous.itemLevel).toBe(recipe.itemLevel - 13);
        expect(getCatalog(profile).items.get(previous.itemId)?.setName).toBe(
          getCatalog(profile).items.get(recipe.itemId)?.setName,
        );
      }
    }
  },
);
it.each([
  [
    "duplicate recipe",
    (m: PurchaseManifest) => {
      m.recipes[1].id = m.recipes[0].id;
    },
  ],
  [
    "duplicate item",
    (m: PurchaseManifest) => {
      m.recipes[1].itemId = m.recipes[0].itemId;
    },
  ],
  [
    "missing item",
    (m: PurchaseManifest) => {
      m.recipes[0].itemId = 1;
    },
  ],
  [
    "negative cost",
    (m: PurchaseManifest) => {
      m.recipes[0].cost = { triumph: -1 };
    },
  ],
  [
    "fractional cost",
    (m: PurchaseManifest) => {
      m.recipes[0].cost = { triumph: 1.5 };
    },
  ],
  [
    "unknown resource",
    (m: PurchaseManifest) => {
      m.recipes[0].cost = { gold: 50 } as never;
    },
  ],
  [
    "wrong family",
    (m: PurchaseManifest) => {
      m.recipes.find((r) => r.itemId === 48494)!.cost = {
        "regalia:protector": 1,
      };
    },
  ],
  [
    "missing predecessor",
    (m: PurchaseManifest) => {
      m.recipes = m.recipes.filter((r) => r.itemId !== 50098);
    },
  ],
  [
    "cross variant",
    (m: PurchaseManifest) => {
      m.recipes.find((r) => r.itemId === 51125)!.prerequisiteItemId = 50853;
    },
  ],
  [
    "cycle",
    (m: PurchaseManifest) => {
      m.recipes.find((r) => r.itemId === 50098)!.prerequisiteItemId = 51314;
    },
  ],
  [
    "wrong faction",
    (m: PurchaseManifest) => {
      m.recipes[0].faction = "both";
    },
  ],
  [
    "wrong profile",
    (m: PurchaseManifest) => {
      m.recipes[0].profiles = ["future" as never];
    },
  ],
  [
    "missing profile",
    (m: PurchaseManifest) => {
      m.recipes[0].profiles = ["classic"];
    },
  ],
  [
    "wrong class",
    (m: PurchaseManifest) => {
      m.recipes[0].classId = 10;
    },
  ],
  [
    "wrong slot",
    (m: PurchaseManifest) => {
      m.recipes[0].slot = "hands";
    },
  ],
] as const)("rejects %s", (_, mutate) => {
  const m = copy();
  mutate(m);
  expect(() => createPurchaseCatalog(m, "original")).toThrow();
});
it("normalizes revision content independently of object order and source check dates", () => {
  const m = copy(),
    original = normalizedPurchaseManifest(m);
  m.checkedAt = "2099-01-01";
  m.recipes.reverse();
  expect(normalizedPurchaseManifest(m)).toBe(original);
  m.recipes[0].cost = { frost: 1 };
  expect(normalizedPurchaseManifest(m)).not.toBe(original);
});
it("builds the deterministic DK domain fixture", () => {
  const r = purchaseFixture({ frost: 60 });
  expect(r.snapshot.inventory.map((i) => i.instanceId)).toEqual(["owned-legs"]);
  expect(r.snapshot.equipped.legs).toBe("owned-legs");
  expect(r.purchases?.recipeRevision).toBe(
    getPurchaseCatalog("original").revision,
  );
  expect(purchasePolicy.maxUnits).toBe(20000);
});

import { validatePurchaseManifest } from "../../../tools/data/purchases";
it("validates the committed semantic revision during offline generation", () => {
  expect(() => validatePurchaseManifest()).not.toThrow();
});

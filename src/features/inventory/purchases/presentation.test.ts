import { expect, it } from "vitest";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { listSpecs } from "@/features/settings/registry";
import { orderPurchaseVariants } from "./presentation";

it.each([
  ["feral_druid", "druid-feral"],
  ["balance_druid", "druid-balance"],
  ["elemental_shaman", "shaman-elemental"],
  ["enhancement_shaman", "shaman-enhancement"],
  ["warrior", "warrior-dps"],
  ["deathknight", "dk-dps"],
  ["retribution_paladin", "paladin-retribution"],
  ["shadow_priest", "priest-shadow"],
])(
  "prioritizes %s's exact variant without changing slots, quality, ownership positions or identity",
  (module, variant) => {
    for (const profile of ["original", "classic"] as const) {
      const spec = listSpecs().find((s) => s.module === module)!;
      const recipes = getPurchaseCatalog(profile).recipes.filter(
        (r) => r.classId === spec.classId && r.faction !== "horde",
      );
      // Relevant last makes this regression exercise ordering even when the manifest already favors DPS.
      const items = recipes.toSorted(
        (a, b) =>
          Number(a.setVariant === variant) - Number(b.setVariant === variant),
      );
      const owned = { ...items[0], id: "owned" };
      items.splice(2, 0, owned);
      const before = items.map((r) => r.id);
      const ordered = orderPurchaseVariants(
        items,
        (r) => (r === owned ? undefined : r),
        spec.id,
        spec.classId,
      );
      expect(ordered[2]).toBe(owned);
      expect(ordered.map((r) => r.id).sort()).toEqual([...before].sort());
      expect(items.map((r) => r.id)).toEqual(before);
      const groups = new Set(
        recipes.map((r) => `${r.tier}:${r.itemLevel}:${r.slot}`),
      );
      for (const group of groups) {
        const matching = ordered.filter(
          (r) => r !== owned && `${r.tier}:${r.itemLevel}:${r.slot}` === group,
        );
        expect(matching[0].setVariant).toBe(variant);
      }
      expect(ordered.map((r) => `${r.tier}:${r.itemLevel}:${r.slot}`)).toEqual(
        items.map((r) => `${r.tier}:${r.itemLevel}:${r.slot}`),
      );
    }
  },
);

it.each([
  "smite_priest:StandardTalents",
  "unknown:StandardTalents",
  "warrior:UnknownPreset",
])("keeps ambiguous or unknown %s in stable source order", (specId) => {
  const recipes = [...getPurchaseCatalog("original").recipes].reverse();
  expect(
    orderPurchaseVariants(
      recipes,
      (r) => r,
      specId,
      listSpecs().find((s) => s.id === specId)?.classId ?? 9,
    ),
  ).toEqual(recipes);
});

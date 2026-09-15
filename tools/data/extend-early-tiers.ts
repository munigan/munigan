/** Reviewed T7/T8 slot-token rules; set membership comes from the item catalog.
 * Sources: https://www.wowhead.com/wotlk/guide/raids/tier-7-raid-sets
 * https://www.wowhead.com/wotlk/guide/raids/tier-8-sets-overview
 * Run with pnpm exec tsx tools/data/extend-early-tiers.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { getCatalog } from "../../src/domain/equipment/catalog";
import {
  normalizedPurchaseManifest,
  tokenFamilyForClass,
  type PurchaseManifest,
} from "../../src/domain/purchases/catalog";
import type {
  PurchaseRecipe,
  ResourceAmounts,
  ResourceId,
} from "../../src/domain/purchases/model";
const mapping: [number, string, string, string][] = [
  [3, "mage-dps", "Frostfire Garb", "Kirin Tor Garb"],
  [8, "warlock-dps", "Plagueheart Garb", "Deathbringer Garb"],
  [5, "priest-shadow", "Regalia of Faith", "Sanctification Regalia"],
  [5, "priest-healing", "Garb of Faith", "Sanctification Garb"],
  [1, "druid-balance", "Dreamwalker Regalia", "Nightsong Regalia"],
  [1, "druid-restoration", "Dreamwalker Garb", "Nightsong Garb"],
  [1, "druid-feral", "Dreamwalker Battlegear", "Nightsong Battlegear"],
  [6, "rogue-dps", "Bonescythe Battlegear", "Terrorblade Battlegear"],
  [2, "hunter-dps", "Cryptstalker Battlegear", "Scourgestalker Battlegear"],
  [7, "shaman-elemental", "Earthshatter Regalia", "Worldbreaker Regalia"],
  [7, "shaman-restoration", "Earthshatter Garb", "Worldbreaker Garb"],
  [
    7,
    "shaman-enhancement",
    "Earthshatter Battlegear",
    "Worldbreaker Battlegear",
  ],
  [9, "warrior-dps", "Dreadnaught Battlegear", "Siegebreaker Battlegear"],
  [9, "warrior-tank", "Dreadnaught Plate", "Siegebreaker Plate"],
  [10, "dk-dps", "Scourgeborne Battlegear", "Darkruned Battlegear"],
  [10, "dk-tank", "Scourgeborne Plate", "Darkruned Plate"],
  [4, "paladin-holy", "Redemption Regalia", "Aegis Regalia"],
  [4, "paladin-retribution", "Redemption Battlegear", "Aegis Battlegear"],
  [4, "paladin-protection", "Redemption Plate", "Aegis Plate"],
];
const manifest = JSON.parse(
  readFileSync("data/wotlk/purchases.json", "utf8"),
) as PurchaseManifest;
manifest.sets = manifest.sets.filter((s) => s.tier >= 9);
manifest.recipes = manifest.recipes.filter((r) => r.tier >= 9);
const slots: Record<number, PurchaseRecipe["slot"]> = {
  1: "head",
  3: "shoulder",
  5: "chest",
  7: "hands",
  9: "legs",
};
for (const [classId, setVariant, t7, t8] of mapping)
  for (const tier of [7, 8] as const) {
    const setName = tier === 7 ? t7 : t8;
    const group = {
      tier,
      setVariant,
      classId,
      faction: "both" as const,
      setName,
    };
    manifest.sets.push(group);
    const items = [...getCatalog("original").items.values()].filter(
      (i) =>
        i.classAllowlist.includes(classId) &&
        i.setName.replace("Kirin'dor", "Kirin Tor") === setName &&
        slots[i.type] &&
        (tier === 7 ? [200, 213] : [219, 226]).includes(i.ilvl),
    );
    if (items.length !== 10)
      throw new Error(`${setName}: expected 10 items, got ${items.length}`);
    for (const item of items) {
      const slot = slots[item.type];
      const size = item.ilvl === 200 || item.ilvl === 219 ? 10 : 25;
      const token: ResourceId = `tier:${tier}:${size}:${slot}:${tokenFamilyForClass(classId)}`;
      const alternative: ResourceAmounts | undefined =
        tier === 7 && size === 10 && ["chest", "hands"].includes(slot)
          ? { heroism: slot === "chest" ? 80 : 60 }
          : tier === 7 && size === 25 && ["legs", "shoulder"].includes(slot)
            ? { valor: slot === "legs" ? 75 : 60 }
            : tier === 8 && size === 25 && ["head", "chest"].includes(slot)
              ? { conquest: 58 }
              : undefined;
      manifest.recipes.push({
        id: `t${tier}-${setVariant}-both-${slot}-${item.ilvl}`,
        itemId: item.id,
        tier,
        itemLevel: item.ilvl as PurchaseRecipe["itemLevel"],
        setVariant,
        slot,
        classId,
        faction: "both",
        profiles: ["original", "classic"],
        cost: { [token]: 1 },
        ...(alternative ? { alternativeCosts: [alternative] } : {}),
        sourceUrls: [
          `https://www.wowhead.com/wotlk/item=${item.id}`,
          tier === 7
            ? "https://www.wowhead.com/wotlk/guide/raids/tier-7-raid-sets"
            : "https://www.wowhead.com/wotlk/guide/raids/tier-8-sets-overview",
        ],
      });
    }
  }
manifest.revision = `purchases-v1:${createHash("sha256").update(normalizedPurchaseManifest(manifest)).digest("hex")}`;
manifest.checkedAt = "2026-09-14";
writeFileSync(
  "data/wotlk/purchases.json",
  JSON.stringify(manifest, null, 2).replace(
    /\{\n      [\s\S]*?\n    \}/g,
    (value) => JSON.stringify(JSON.parse(value)),
  ) + "\n",
);
console.log(`${manifest.recipes.length} reviewed recipes`);

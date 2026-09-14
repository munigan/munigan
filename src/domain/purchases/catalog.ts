import manifestData from "../../../data/wotlk/purchases.json";
import { getCatalog } from "@/domain/equipment/catalog";
import { itemVersions, type ItemVersion } from "@/domain/top-gear/item-version";
import type {
  PurchaseCatalog,
  PurchaseRecipe,
  ResourceAmounts,
  TokenFamily,
} from "./model";

export type PurchaseManifest = {
  version: 1;
  revision: string;
  checkedAt: string;
  sets: Array<{
    tier: 9 | 10;
    setVariant: string;
    classId: number;
    faction: PurchaseRecipe["faction"];
    setName: string;
  }>;
  recipes: PurchaseRecipe[];
};
const families: Record<number, TokenFamily> = {
  1: "vanquisher",
  2: "protector",
  3: "vanquisher",
  4: "conqueror",
  5: "conqueror",
  6: "vanquisher",
  7: "protector",
  8: "conqueror",
  9: "protector",
  10: "vanquisher",
};
export function tokenFamilyForClass(classId: number): TokenFamily {
  const family = families[classId];
  if (!family) throw new Error(`Unsupported purchase class ${classId}`);
  return family;
}

/** Stable semantic input to the offline SHA-256 revision; dates are audit metadata. */
export function normalizedPurchaseManifest(manifest: PurchaseManifest): string {
  function normalize(value: unknown): unknown {
    if (Array.isArray(value))
      return value
        .map(normalize)
        .sort((a, b) =>
          JSON.stringify(a) < JSON.stringify(b)
            ? -1
            : JSON.stringify(a) > JSON.stringify(b)
              ? 1
              : 0,
        );
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    return value;
  }
  return JSON.stringify(
    normalize({
      version: manifest.version,
      sets: manifest.sets,
      recipes: manifest.recipes,
    }),
  );
}
const slotTypes = {
  head: 1,
  shoulder: 3,
  chest: 5,
  hands: 7,
  legs: 9,
} as const;
function expectedCost(recipe: PurchaseRecipe): ResourceAmounts {
  const small = recipe.slot === "hands" || recipe.slot === "shoulder";
  const family = tokenFamilyForClass(recipe.classId);
  switch (recipe.itemLevel) {
    case 232:
      return { triumph: small ? 30 : 50 };
    case 245:
      return { triumph: small ? 45 : 75, trophy: 1 };
    case 258:
      return { [`regalia:${family}`]: 1 };
    case 251:
      return { frost: small ? 60 : 95 };
    case 264:
      return { [`mark:normal:${family}`]: 1 };
    case 277:
      return { [`mark:heroic:${family}`]: 1 };
    default:
      throw new Error(`Invalid quality for ${recipe.id}`);
  }
}
function equalCost(a: ResourceAmounts, b: ResourceAmounts) {
  const entries = Object.entries(a);
  return (
    entries.length === Object.keys(b).length &&
    entries.every(
      ([key, value]) =>
        Number.isSafeInteger(value) &&
        value > 0 &&
        b[key as keyof ResourceAmounts] === value,
    )
  );
}

/** Validate reviewed data against each profile before exposing its runtime index. */
export function createPurchaseCatalog(
  manifest: PurchaseManifest,
  profile: ItemVersion,
): PurchaseCatalog {
  if (
    manifest.version !== 1 ||
    !manifest.revision ||
    !(profile in itemVersions)
  )
    throw new Error("Invalid purchase manifest version");
  const profiles = Object.keys(itemVersions) as ItemVersion[];
  const ids = new Set<string>(),
    itemIds = new Set<number>();
  for (const recipe of manifest.recipes) {
    if (ids.has(recipe.id) || itemIds.has(recipe.itemId))
      throw new Error(`Duplicate purchase recipe/item ${recipe.id}`);
    ids.add(recipe.id);
    itemIds.add(recipe.itemId);
    if (
      !recipe.id ||
      !recipe.sourceUrls.length ||
      recipe.sourceUrls.some((url) => !url.startsWith("https://"))
    )
      throw new Error(`Missing provenance for ${recipe.id}`);
    if (
      recipe.profiles.length !== profiles.length ||
      new Set(recipe.profiles).size !== profiles.length ||
      recipe.profiles.some((p) => !profiles.includes(p))
    )
      throw new Error(`Invalid profile membership for ${recipe.id}`);
    if (!equalCost(recipe.cost, expectedCost(recipe)))
      throw new Error(`Invalid cost for ${recipe.id}`);
    if (
      !(
        recipe.tier === 9
          ? [232, 245, 258]
          : recipe.tier === 10
            ? [251, 264, 277]
            : []
      ).includes(recipe.itemLevel)
    )
      throw new Error(`Invalid tier for ${recipe.id}`);
  }
  const recipes = manifest.recipes.filter((r) => r.profiles.includes(profile));
  const byItemId = new Map(recipes.map((r) => [r.itemId, r]));
  const catalog = getCatalog(profile);
  const groups = new Set<string>();
  for (const group of manifest.sets) {
    const key = `${group.tier}:${group.setVariant}:${group.faction}`;
    if (groups.has(key)) throw new Error(`Duplicate purchase set ${key}`);
    groups.add(key);
    const members = recipes.filter(
      (r) =>
        r.tier === group.tier &&
        r.setVariant === group.setVariant &&
        r.faction === group.faction,
    );
    const levels = group.tier === 9 ? [232, 245, 258] : [251, 264, 277];
    if (
      members.length !== 15 ||
      levels.some((level) =>
        Object.keys(slotTypes).some(
          (slot) =>
            members.filter((r) => r.itemLevel === level && r.slot === slot)
              .length !== 1,
        ),
      )
    )
      throw new Error(`Incomplete purchase set ${key}`);
  }
  for (const recipe of recipes) {
    const item = catalog.items.get(recipe.itemId);
    if (!item || catalog.unsupportedItemIds?.has(recipe.itemId))
      throw new Error(`Missing ${profile} purchase item ${recipe.itemId}`);
    const group = manifest.sets.find(
      (s) =>
        s.tier === recipe.tier &&
        s.setVariant === recipe.setVariant &&
        s.faction === recipe.faction,
    );
    const faction =
      item.factionRestriction === 1
        ? "alliance"
        : item.factionRestriction === 2
          ? "horde"
          : "both";
    if (
      !group ||
      group.classId !== recipe.classId ||
      group.setName !== item.setName ||
      !item.classAllowlist.includes(recipe.classId) ||
      item.ilvl !== recipe.itemLevel ||
      item.type !== slotTypes[recipe.slot] ||
      faction !== recipe.faction
    )
      throw new Error(`Invalid item membership for ${recipe.id}`);
    const requiresPrevious = recipe.tier === 10 && recipe.itemLevel !== 251;
    if (requiresPrevious !== (recipe.prerequisiteItemId !== undefined))
      throw new Error(`Invalid prerequisite requirement for ${recipe.id}`);
    if (recipe.prerequisiteItemId !== undefined) {
      const previous = byItemId.get(recipe.prerequisiteItemId);
      if (
        !previous ||
        previous.tier !== 10 ||
        previous.itemLevel !== recipe.itemLevel - 13 ||
        previous.slot !== recipe.slot ||
        previous.classId !== recipe.classId ||
        previous.setVariant !== recipe.setVariant ||
        previous.faction !== recipe.faction
      )
        throw new Error(`Invalid predecessor for ${recipe.id}`);
      const seen = new Set([recipe.itemId]);
      let current: PurchaseRecipe | undefined = previous;
      while (current) {
        if (seen.has(current.itemId))
          throw new Error(`Purchase cycle for ${recipe.id}`);
        seen.add(current.itemId);
        current =
          current.prerequisiteItemId === undefined
            ? undefined
            : byItemId.get(current.prerequisiteItemId);
      }
    }
  }
  return { revision: manifest.revision, recipes, byItemId };
}
const cached: Partial<Record<ItemVersion, PurchaseCatalog>> = {};
export function getPurchaseCatalog(version: ItemVersion): PurchaseCatalog {
  return (cached[version] ??= createPurchaseCatalog(
    manifestData as PurchaseManifest,
    version,
  ));
}

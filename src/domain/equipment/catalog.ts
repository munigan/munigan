import restrictions from "../../../data/wotlk/equipment-limits.json";
import data from "../../../data/wotlk/db.json";
import original from "../../../data/wotlk/original-items.json";
import type { ItemVersion } from "@/domain/top-gear/item-version";
import { UIDatabase, UIItem, UIEnchant, UIGem } from "@/generated/wotlk/ui";
import type { JsonValue } from "@protobuf-ts/runtime";
export type ItemRestriction = {
  category: number;
  requiredSkill: number;
  requiredSkillRank: number;
  uniqueEquipped: boolean;
  maxOwned: number;
};
export type Catalog = {
  icons?: Map<number, { id: number; name: string; icon: string }>;
  unsupportedItemIds?: Set<number>;
  adjustedItemIds?: Set<number>;
  restrictions?: {
    items: Record<string, ItemRestriction>;
    categories: Record<
      string,
      { name: string; quantity: number; mode: number }
    >;
  };
  items: Map<number, UIItem>;
  gems: Map<number, UIGem>;
  enchants: Map<number, UIEnchant[]>;
};
export function createCatalog(data: {
  items: UIItem[];
  gems: UIGem[];
  enchants: UIEnchant[];
  itemIcons?: Array<{ id: number; name: string; icon: string }>;
  spellIcons?: Array<{ id: number; name: string; icon: string }>;
}): Catalog {
  const icons = new Map((data.itemIcons ?? []).map((item) => [item.id, item]));
  const spells = new Map(
    (data.spellIcons ?? []).map((spell) => [spell.id, spell]),
  );
  const enchants = new Map<number, UIEnchant[]>();
  for (const e of data.enchants)
    enchants.set(e.effectId, [
      ...(enchants.get(e.effectId) ?? []),
      {
        ...e,
        icon:
          e.icon ||
          icons.get(e.itemId)?.icon ||
          spells.get(e.spellId)?.icon ||
          "",
      },
    ]);
  return {
    icons,
    items: new Map(data.items.map((i) => [i.id, i])),
    gems: new Map(data.gems.map((g) => [g.id, g])),
    enchants,
  };
}
const cached: Partial<Record<ItemVersion, Catalog>> = {};
export function getCatalog(version: ItemVersion = "classic") {
  if (cached[version]) return cached[version];
  const catalog: Catalog = {
    ...createCatalog(UIDatabase.fromJson(data as unknown as JsonValue)),
    restrictions,
  };
  if (version === "original") {
    catalog.adjustedItemIds = new Set(original.items.map((item) => item.id));
    for (const item of UIDatabase.fromJson({
      items: original.items,
    } as unknown as JsonValue).items)
      catalog.items.set(item.id, item);
    catalog.unsupportedItemIds = new Set(original.unsupportedItemIds);
  }
  cached[version] = catalog;
  return catalog;
}

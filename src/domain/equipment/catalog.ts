import restrictions from "../../../data/wotlk/equipment-limits.json";
import data from "../../../data/wotlk/db.json";
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
}): Catalog {
  const enchants = new Map<number, UIEnchant[]>();
  for (const e of data.enchants)
    enchants.set(e.effectId, [...(enchants.get(e.effectId) ?? []), e]);
  return {
    items: new Map(data.items.map((i) => [i.id, i])),
    gems: new Map(data.gems.map((g) => [g.id, g])),
    enchants,
  };
}
let cached: Catalog | undefined;
export function getCatalog() {
  return (cached ??= {
    ...createCatalog(UIDatabase.fromJson(data as unknown as JsonValue)),
    restrictions,
  });
}

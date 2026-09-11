import { Stat } from "@/generated/wotlk/common";
import type { InventoryTranslation } from "./item-labels";
// Shared ratings are duplicated by the engine for melee/spell calculations.
const duplicateOf: Record<number, number> = {
  [Stat.StatSpellCrit]: Stat.StatMeleeCrit,
  [Stat.StatSpellHit]: Stat.StatMeleeHit,
  [Stat.StatSpellHaste]: Stat.StatMeleeHaste,
  [Stat.StatRangedAttackPower]: Stat.StatAttackPower,
};
export function statLines(
  stats: number[],
  t: InventoryTranslation,
  locale: string,
) {
  return stats.flatMap((value, index) => {
    if (!value || (index in duplicateOf && stats[duplicateOf[index]] === value))
      return [];
    const key = Stat[index]?.slice(4);
    const name = key ? t(`stats.${key}`) : t("stats.unknown", { id: index });
    return [`${value > 0 ? "+" : ""}${value.toLocaleString(locale)} ${name}`];
  });
}

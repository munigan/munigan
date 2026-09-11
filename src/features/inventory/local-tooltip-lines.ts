import {
  ArmorType,
  HandType,
  ItemType,
  RangedWeaponType,
  Stat,
  WeaponType,
} from "@/generated/wotlk/common";
import type { UIItem, UIGem } from "@/generated/wotlk/ui";
import type { TooltipLine } from "@/domain/tooltips/contracts";
import type { InventoryTranslation } from "./item-labels";
import { statLines } from "./stat-labels";

const equipmentEffects = new Set([
  Stat.StatSpellPower,
  Stat.StatMP5,
  Stat.StatSpellHit,
  Stat.StatSpellCrit,
  Stat.StatSpellHaste,
  Stat.StatSpellPenetration,
  Stat.StatAttackPower,
  Stat.StatRangedAttackPower,
  Stat.StatMeleeHit,
  Stat.StatMeleeCrit,
  Stat.StatMeleeHaste,
  Stat.StatArmorPenetration,
  Stat.StatExpertise,
  Stat.StatDefense,
  Stat.StatBlock,
  Stat.StatDodge,
  Stat.StatParry,
  Stat.StatResilience,
]);

// Local facts use the service's line model and renderer. Do not infer binding,
// requirements, durability, or proc descriptions absent from the catalog.
export function localTooltipLines(
  gear: UIItem | undefined,
  gem: UIGem | undefined,
  effects: string[],
  t: InventoryTranslation,
  locale: string,
): TooltipLine[] {
  if (!gear)
    return gem
      ? statLines(gem.stats, t, locale).map((text) => ({ kind: "stat", text }))
      : [];
  const lines: TooltipLine[] = [];
  const type = ItemType[gear.type]?.replace("ItemType", "");
  const specialSlots: Record<string, string> = {
    Finger: "tooltip.finger",
    Trinket: "tooltip.trinket",
    Weapon: `tooltip.hands.${HandType[gear.handType]?.replace("HandType", "") ?? "Unknown"}`,
  };
  const slot =
    type && type !== "Unknown"
      ? t(
          specialSlots[type] ??
            `slots.${type.charAt(0).toLowerCase()}${type.slice(1)}`,
        )
      : undefined;
  const subtype =
    gear.type === ItemType.ItemTypeWeapon
      ? gear.weaponType &&
        `picker.types.weapon.${WeaponType[gear.weaponType]?.replace("WeaponType", "")}`
      : gear.type === ItemType.ItemTypeRanged
        ? gear.rangedWeaponType &&
          `picker.types.ranged.${RangedWeaponType[gear.rangedWeaponType]?.replace("RangedWeaponType", "")}`
        : gear.armorType &&
          `picker.types.armor.${ArmorType[gear.armorType]?.replace("ArmorType", "")}`;
  if (slot)
    lines.push({
      kind: "slot",
      text: slot,
      ...(subtype ? { rightText: t(subtype) } : {}),
    });
  if (gear.weaponSpeed) {
    lines.push({
      kind: "weapon",
      text: t("tooltip.damage", {
        min: gear.weaponDamageMin.toLocaleString(locale),
        max: gear.weaponDamageMax.toLocaleString(locale),
      }),
      rightText: t("tooltip.speed", {
        value: gear.weaponSpeed.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      }),
    });
    lines.push({
      kind: "weapon",
      text: t("tooltip.dps", {
        value: (
          (gear.weaponDamageMin + gear.weaponDamageMax) /
          (2 * gear.weaponSpeed)
        ).toLocaleString(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      }),
    });
  }
  if (gear.stats[Stat.StatArmor])
    lines.push({
      kind: "stat",
      text: `${gear.stats[Stat.StatArmor].toLocaleString(locale)} ${t("stats.Armor")}`,
    });
  const base = gear.stats.map((value, index) =>
    index === Stat.StatArmor || equipmentEffects.has(index) ? 0 : value,
  );
  const equipped = gear.stats.map((value, index) =>
    equipmentEffects.has(index) ? value : 0,
  );
  lines.push(
    ...statLines(base, t, locale).map((text) => ({
      kind: "stat" as const,
      text,
    })),
  );
  // Providers normally list ratings before spell power.
  const spellPower = equipped[Stat.StatSpellPower];
  equipped[Stat.StatSpellPower] = 0;
  lines.push(
    ...statLines(equipped, t, locale).map((text) => ({
      kind: "effect" as const,
      text: t("tooltip.equipStat", { stat: text }),
    })),
  );
  if (spellPower) {
    const spellStats = gear.stats.map((_, index) =>
      index === Stat.StatSpellPower ? spellPower : 0,
    );
    lines.push(
      ...statLines(spellStats, t, locale).map((text) => ({
        kind: "effect" as const,
        text: t("tooltip.equipStat", { stat: text }),
      })),
    );
  }
  lines.push(...effects.map((text) => ({ kind: "effect" as const, text })));
  return lines;
}

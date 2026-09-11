import { Stat } from "@/generated/wotlk/common";
import type { UIItem } from "@/generated/wotlk/ui";

const casters = new Set([
  "balance_druid",
  "elemental_shaman",
  "mage",
  "shadow_priest",
  "smite_priest",
  "warlock",
]);
const agilitySpecs = new Set([
  "feral_druid",
  "enhancement_shaman",
  "hunter",
  "rogue",
]);
const stat = (item: UIItem, key: Stat) => item.stats[key] ?? 0;
const sum = (item: UIItem, keys: Stat[]) =>
  keys.reduce((total, key) => total + stat(item, key), 0);

/** Broad stat intent, not EP or predicted DPS. Proc-only items remain available as unknowns. */
function intentTier(item: UIItem, caster: boolean) {
  const physical = sum(item, [
    Stat.StatStrength,
    Stat.StatAgility,
    Stat.StatAttackPower,
    Stat.StatRangedAttackPower,
    Stat.StatArmorPenetration,
    Stat.StatExpertise,
  ]);
  const spell =
    stat(item, Stat.StatSpellPower) > 0 ||
    (!physical && stat(item, Stat.StatIntellect) > 0);
  const tank =
    sum(item, [
      Stat.StatDefense,
      Stat.StatDodge,
      Stat.StatParry,
      Stat.StatBlock,
      Stat.StatBlockValue,
    ]) > 0;
  if ((caster && physical > 0 && !spell) || (!caster && spell)) return 3;
  if (tank) return 2;
  // Spirit is useful to several DPS specs, so it is deliberately not a healer signal.
  if (caster && stat(item, Stat.StatMP5) > 0 && !stat(item, Stat.StatSpellHit))
    return 2;
  if ((caster && spell) || (!caster && physical > 0)) return 0;
  // Wrath's hit/crit/haste entries are often shared between melee and spell stats.
  if (
    sum(item, [
      Stat.StatMeleeHit,
      Stat.StatMeleeCrit,
      Stat.StatMeleeHaste,
      Stat.StatSpellHit,
      Stat.StatSpellCrit,
      Stat.StatSpellHaste,
    ]) > 0
  )
    return 0;
  return 1;
}

export function compareSpecItems(a: UIItem, b: UIItem, module: string) {
  const caster = casters.has(module);
  const primary = caster
    ? Stat.StatSpellPower
    : agilitySpecs.has(module)
      ? Stat.StatAgility
      : Stat.StatStrength;
  // Keep higher-level viable off-armor pieces ahead of lower-level class armor.
  // Primary-stat affinity only breaks ties within the same intent and item level.
  return (
    intentTier(a, caster) - intentTier(b, caster) ||
    b.ilvl - a.ilvl ||
    stat(b, primary) - stat(a, primary)
  );
}

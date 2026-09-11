import { expect, it } from "vitest";
import { UIItem } from "@/generated/wotlk/ui";
import { Stat } from "@/generated/wotlk/common";
import { emptyItemFilters, filterItems } from "./custom-items";

function item(id: number, ilvl: number, values: Partial<Record<Stat, number>>) {
  const stats: number[] = [];
  for (const [stat, value] of Object.entries(values))
    stats[Number(stat)] = value!;
  return UIItem.create({ id, name: `Item ${id}`, ilvl, stats });
}
const strength = item(1, 264, {
  [Stat.StatStrength]: 160,
  [Stat.StatMeleeHit]: 80,
});
const agility = item(2, 264, {
  [Stat.StatAgility]: 160,
  [Stat.StatAttackPower]: 200,
});
const caster = item(3, 277, {
  [Stat.StatIntellect]: 150,
  [Stat.StatSpellPower]: 200,
});
const tank = item(4, 277, { [Stat.StatStrength]: 180, [Stat.StatDefense]: 80 });
const proc = item(5, 277, {});
const items = [caster, tank, proc, agility, strength];
const related = { ...emptyItemFilters, sort: "relevance" };

it("prioritizes physical DPS gear while retaining tank, caster and unknown-effect candidates", () => {
  const result = filterItems(items, related, "warrior");
  expect(result[0]).toBe(strength);
  expect(result[1]).toBe(agility);
  expect(result.indexOf(proc)).toBeLessThan(result.indexOf(tank));
  expect(result.indexOf(tank)).toBeLessThan(result.indexOf(caster));
  expect(result).toHaveLength(items.length);
});
it("uses the specialization, including caster and melee variants of the same class", () => {
  expect(filterItems(items, related, "elemental_shaman")[0]).toBe(caster);
  expect(filterItems(items, related, "enhancement_shaman")[0]).toBe(agility);
  expect(filterItems(items, related, "hunter")[0]).toBe(agility);
  expect(filterItems(items, related, "deathknight")[0]).toBe(strength);
});
it("keeps item level dominant among relevant DPS items and respects explicit sort/search", () => {
  const higherAgility = { ...agility, ilvl: 277 };
  expect(filterItems([strength, higherAgility], related, "warrior")[0]).toBe(
    higherAgility,
  );
  expect(
    filterItems(items, { ...related, sort: "level-desc" }, "warrior")[0],
  ).toBe(caster);
  expect(
    filterItems(items, { ...related, search: "Item 3" }, "warrior"),
  ).toEqual([caster]);
  expect(items[0]).toBe(caster);
});
it("does not mistake shared hit/crit/haste rating or mana alone for caster gear", () => {
  const hybrid = item(6, 277, {
    [Stat.StatAgility]: 100,
    [Stat.StatIntellect]: 80,
    [Stat.StatSpellHit]: 70,
    [Stat.StatMeleeHit]: 70,
  });
  const shared = item(7, 277, {
    [Stat.StatSpellHit]: 70,
    [Stat.StatMeleeHit]: 70,
  });
  expect(filterItems([caster, hybrid], related, "hunter")[0]).toBe(hybrid);
  expect(filterItems([tank, shared], related, "warrior")[0]).toBe(shared);
});

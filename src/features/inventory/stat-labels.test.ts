import { expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { Stat } from "@/generated/wotlk/common";
import { getCatalog } from "@/domain/equipment/catalog";
import conditions from "../../../data/wotlk/meta-gem-conditions.json";
import en from "../../../messages/en-US/inventory.json";
import pt from "../../../messages/pt-BR/inventory.json";
import { statLines } from "./stat-labels";
import { gemDescription, gemEffectKeys } from "./gem-labels";
import type { InventoryTranslation } from "./item-labels";

const translations = {
  "en-US": createTranslator({
    locale: "en-US",
    messages: en,
  }) as InventoryTranslation,
  "pt-BR": createTranslator({
    locale: "pt-BR",
    messages: pt,
  }) as InventoryTranslation,
};
it("formats structured stat values without changing values or duplicating shared ratings", () => {
  const stats = Array(35).fill(0);
  stats[Stat.StatAttackPower] = stats[Stat.StatRangedAttackPower] = 1234.5;
  stats[Stat.StatMeleeCrit] = stats[Stat.StatSpellCrit] = 21;
  const original = [...stats];
  expect(statLines(stats, translations["en-US"], "en-US")).toEqual([
    "+1,234.5 Attack Power",
    "+21 Crit",
  ]);
  expect(statLines(stats, translations["pt-BR"], "pt-BR")).toEqual([
    "+1.234,5 Poder de ataque",
    "+21 Crítico",
  ]);
  expect(stats).toEqual(original);
});
it("provides stat labels and explicit effects for every supported meta gem", () => {
  for (const name of Object.keys(Stat).filter((key) =>
    key.startsWith("Stat"),
  )) {
    expect(en.stats).toHaveProperty(name.slice(4));
    expect(pt.stats).toHaveProperty(name.slice(4));
  }
  const catalog = getCatalog();
  for (const id of Object.keys(conditions.conditions)) {
    expect(gemEffectKeys[Number(id)], id).toBeTruthy();
    const gem = catalog.gems.get(Number(id));
    if (!gem) continue;
    const previous = JSON.stringify(gem);
    for (const locale of ["en-US", "pt-BR"] as const) {
      const description = gemDescription(gem, translations[locale], locale);
      expect(description).toBeTruthy();
      expect(description).not.toContain("gemEffects.");
    }
    expect(JSON.stringify(gem)).toBe(previous);
  }
});

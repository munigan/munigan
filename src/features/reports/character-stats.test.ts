import { describe, expect, it } from "vitest";
import { createCatalog } from "@/domain/equipment/catalog";
import type { SetRow, Snapshot } from "@/domain/top-gear/model";
import {
  Race,
  Stat,
  TristateEffect,
  WeaponType,
} from "@/generated/wotlk/common";
import { PaladinMajorGlyph, PaladinSeal } from "@/generated/wotlk/paladin";
import { UIItem } from "@/generated/wotlk/ui";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import { readTalents } from "@/features/settings/talents";
import {
  armorPenetrationPercent,
  capDifferenceLabel,
  characterStats,
  combinationStats,
  primaryStats,
  ratingConversions as r,
} from "./character-stats";

function fixture(specModule = "warrior", preset?: string) {
  const spec = listSpecs().find(
    (s) => s.module === specModule && (!preset || s.id.includes(preset)),
  )!;
  const settings = defaultSettings(spec.id);
  settings.player!.race = Race.RaceTroll;
  settings.player!.inFrontOfTarget = false;
  settings.debuffs!.misery = false;
  settings.debuffs!.faerieFire = TristateEffect.TristateEffectMissing;
  const snapshot = {
    specId: spec.id,
    settings,
    inventory: [],
    equipped: {},
  } as unknown as Snapshot;
  const row = { stats: Array(40).fill(0), loadout: {} } as SetRow;
  return { snapshot, row };
}
const emptyCatalog = createCatalog({ items: [], gems: [], enchants: [] });
const cap = (f: ReturnType<typeof fixture>, id: string) =>
  characterStats(f.row, f.snapshot, emptyCatalog).accuracy.find(
    (s) => s.id === id,
  )!;

describe("class stat presentation", () => {
  it("filters non-DPS attributes and the wrong attack power for every supported spec", () => {
    for (const spec of listSpecs()) {
      const stats = primaryStats(spec.module);
      expect(stats).not.toContain(Stat.StatStamina);
      expect(new Set(stats).size).toBe(stats.length);
      expect(stats).not.toContain(Stat.StatHealth);
      expect(stats).not.toContain(Stat.StatArmor);
    }
    expect(primaryStats("deathknight")).not.toContain(Stat.StatIntellect);
    expect(primaryStats("deathknight")).not.toContain(Stat.StatSpirit);
    expect(primaryStats("hunter")).toContain(Stat.StatIntellect);
    expect(primaryStats("hunter")).not.toContain(Stat.StatStrength);
    expect(primaryStats("hunter")).toContain(Stat.StatRangedAttackPower);
    expect(primaryStats("mage")).toEqual([
      Stat.StatIntellect,
      Stat.StatSpirit,
      Stat.StatSpellPower,
      Stat.StatSpellCrit,
      Stat.StatSpellHaste,
    ]);
    expect(primaryStats("elemental_shaman")).not.toContain(Stat.StatSpirit);
    expect(primaryStats("enhancement_shaman")).toContain(Stat.StatIntellect);
  });
  it("converts Armor Penetration and clamps the effective percentage", () => {
    expect(armorPenetrationPercent(699.5)).toBe(50);
    expect(armorPenetrationPercent(1600)).toBe(100);
    expect(armorPenetrationPercent(-10)).toBe(0);
  });
});

describe("gear combination percentages", () => {
  it("uses each row's stats, expresses expertise as avoidance reduction, and filters melee stats", () => {
    const f = fixture("warrior");
    f.row.stats![Stat.StatMeleeHit] = 7 * r.meleeHit;
    f.row.stats![Stat.StatExpertise] = 26 * r.expertise;
    f.row.stats![Stat.StatArmorPenetration] = 699.5;
    f.row.stats![Stat.StatMeleeCrit] = 40 * r.crit;
    const values = combinationStats(f.row, f.snapshot);
    expect(values.map((s) => s.label)).toEqual([
      "Melee hit",
      "Expertise",
      "Armor pen",
      "Melee crit",
    ]);
    expect(values.map((s) => s.percent)).toEqual([7, 6.5, 50, 40]);
    expect(values[0].capped).toBe(false);
    expect(values[1].capped).toBe(true);
    const other = { ...f.row, stats: [...f.row.stats!] };
    other.stats[Stat.StatMeleeHit] = 9 * r.meleeHit;
    expect(combinationStats(other, f.snapshot)[0].percent).toBe(9);
    expect(combinationStats(f.row, f.snapshot)[0].percent).toBe(7);
  });
  it("shows spell percentages for casters and ranged crit for hunters", () => {
    const f = fixture("mage", "FireTalents");
    f.row.stats![Stat.StatSpellHit] = 10 * r.spellHit;
    f.row.stats![Stat.StatSpellHaste] = 20 * r.haste;
    f.row.stats![Stat.StatSpellCrit] = 30 * r.crit;
    const stats = combinationStats(f.row, f.snapshot);
    expect(stats.map((s) => s.label)).toEqual([
      "Spell hit",
      "Spell haste",
      "Spell crit",
    ]);
    expect(stats.map((s) => s.percent)).toEqual([10, 20, 30]);
    const hunter = fixture("hunter");
    hunter.row.stats![Stat.StatMeleeCrit] = 35 * r.crit;
    expect(
      combinationStats(hunter.row, hunter.snapshot).map((s) => s.label),
    ).toEqual(["Ranged hit", "Armor pen", "Ranged crit"]);
  });
  it("does not fabricate percentages for missing stats", () => {
    const f = fixture();
    expect(combinationStats(f.row, f.snapshot)).toEqual([]);
    expect(
      combinationStats({ ...f.row, stats: undefined }, f.snapshot),
    ).toEqual([]);
  });
});

describe("caps use simulated totals without double-counting passive bonuses", () => {
  it("counts Fury Precision and Draenei presence exactly once", () => {
    const f = fixture("warrior", "Fury");
    f.snapshot.settings.player!.race = Race.RaceDraenei;
    f.snapshot.settings.partyBuffs!.heroicPresence = true;
    // Gear 132 + 3% Precision + 1% racial (already in finalStats).
    f.row.stats![Stat.StatMeleeHit] = 132 + 4 * r.meleeHit;
    const result = cap(f, "melee");
    expect(result.capped).toBe(true);
    expect(result.difference).toBeCloseTo(132 - 4 * r.meleeHit);
    expect(result.effective).toBeCloseTo(8.0256, 3);
  });
  it("shows rating deficits and handles rounding at the cap boundary", () => {
    const f = fixture();
    f.row.stats![Stat.StatMeleeHit] = 8 * r.meleeHit - 32;
    expect(capDifferenceLabel(cap(f, "melee"))).toBe("32 rating below cap");
    f.row.stats![Stat.StatMeleeHit] = 8 * r.meleeHit;
    expect(capDifferenceLabel(cap(f, "melee"))).toBe("At cap");
    f.row.stats![Stat.StatMeleeHit] -= 0.001;
    expect(capDifferenceLabel(cap(f, "melee"))).toBe("1 rating below cap");
    f.row.stats![Stat.StatMeleeHit] = 8 * r.meleeHit + 32.1;
    expect(capDifferenceLabel(cap(f, "melee"))).toBe("32 rating above cap");
  });
  it("uses Arcane Focus for Arcane, without subtracting Precision a second time", () => {
    const f = fixture("mage", "Arcane");
    const talents = readTalents(f.snapshot);
    f.snapshot.settings.debuffs!.misery = true;
    f.row.stats![Stat.StatSpellHit] =
      210 + (talents.precision ?? 0) * r.spellHit;
    const result = cap(f, "spell");
    expect(result.context).toBe("Arcane spells");
    expect(result.effective).toBeCloseTo(
      210 / r.spellHit +
        (talents.precision ?? 0) +
        (talents.arcaneFocus ?? 0) +
        3,
    );
    expect(result.capped).toBe(true);
  });
  it("does not apply Arcane Focus to Fire spells", () => {
    const f = fixture("mage", "FireTalents");
    f.row.stats![Stat.StatSpellHit] = 10 * r.spellHit;
    expect(cap(f, "spell").effective).toBeCloseTo(10);
  });
  it("scopes Frostfire's extra Precision to Frostfire Bolt", () => {
    const f = fixture("mage", "Frostfire");
    f.row.stats![Stat.StatSpellHit] = 11 * r.spellHit;
    const result = cap(f, "spell");
    expect(result.context).toBe("Frostfire Bolt");
    expect(result.effective).toBeCloseTo(
      11 + readTalents(f.snapshot).precision,
    );
    expect(result.bonuses.join(" ")).toContain("Frostfire only");
  });
  it("uses the strongest spell-hit debuff, including the priest's own Misery", () => {
    const f = fixture("shadow_priest");
    const talents = readTalents(f.snapshot);
    f.snapshot.settings.debuffs!.misery = true;
    f.snapshot.settings.debuffs!.faerieFire =
      TristateEffect.TristateEffectImproved;
    f.row.stats![Stat.StatSpellHit] = 11 * r.spellHit;
    expect(cap(f, "spell").effective).toBeCloseTo(11 + 3 + talents.shadowFocus);
    f.snapshot.settings.debuffs!.misery = false;
    f.snapshot.settings.debuffs!.faerieFire =
      TristateEffect.TristateEffectMissing;
    expect(cap(f, "spell").effective).toBeCloseTo(
      11 + talents.misery + talents.shadowFocus,
    );
  });
  it("uses Elemental Precision while Enhancement also keeps a melee cap", () => {
    const f = fixture("elemental_shaman");
    f.row.stats![Stat.StatSpellHit] = 14 * r.spellHit;
    expect(cap(f, "spell").effective).toBeCloseTo(
      14 + readTalents(f.snapshot).elementalPrecision,
    );
    const enhancement = fixture("enhancement_shaman");
    expect(
      characterStats(
        enhancement.row,
        enhancement.snapshot,
        emptyCatalog,
      ).accuracy.map((s) => s.id),
    ).toEqual(["melee", "spell", "expertise"]);
  });
  it("includes poison spell hit for Rogues and only ranged hit for Hunters", () => {
    expect(cap(fixture("rogue"), "spell").context).toBe("Poisons");
    const f = fixture("hunter");
    const result = characterStats(f.row, f.snapshot, emptyCatalog);
    expect(result.accuracy.map((s) => s.label)).toEqual(["Ranged hit"]);
  });
  it("uses target level and front-facing parry caps", () => {
    const f = fixture();
    f.snapshot.settings.encounter!.targets[0].level = 82;
    expect(cap(f, "melee").cap).toBe(6);
    expect(cap(f, "expertise").cap).toBe(24);
    f.snapshot.settings.encounter!.targets[0].level = 83;
    f.snapshot.settings.player!.inFrontOfTarget = true;
    expect(cap(f, "expertise").cap).toBe(56);
  });
});

function armed(race: Race, mh: WeaponType, oh?: WeaponType) {
  const f = fixture("deathknight", "Frost");
  f.snapshot.settings.player!.race = race;
  f.snapshot.inventory = [1, 2].map((id) => ({
    instanceId: String(id),
    itemId: id,
    enchantId: 0,
    gemIds: [],
    source: "equipped" as const,
  }));
  f.row.loadout.mainHand = "1";
  f.row.loadout.offHand = oh === undefined ? null : "2";
  const catalog = createCatalog({
    items: [
      UIItem.create({ id: 1, weaponType: mh }),
      UIItem.create({ id: 2, weaponType: oh }),
    ],
    gems: [],
    enchants: [],
  });
  return { ...f, catalog };
}

describe("racial and seal expertise", () => {
  it.each([
    [Race.RaceHuman, WeaponType.WeaponTypeSword, 3],
    [Race.RaceDwarf, WeaponType.WeaponTypeMace, 5],
    [Race.RaceOrc, WeaponType.WeaponTypeAxe, 5],
    [Race.RaceOrc, WeaponType.WeaponTypeFist, 5],
  ])("handles mixed weapons for race %s", (race, weapon, expertise) => {
    const f = armed(race, weapon, WeaponType.WeaponTypeDagger);
    f.row.stats![Stat.StatExpertise] = 22 * r.expertise;
    const results = characterStats(
      f.row,
      f.snapshot,
      f.catalog,
    ).accuracy.filter((s) => s.stat === Stat.StatExpertise);
    expect(results.map((s) => s.effective)).toEqual([22 + expertise, 22]);
    expect(results[1].capped).toBe(false);
    // Changing the selected combination must move the racial bonus to the other hand.
    [f.row.loadout.mainHand, f.row.loadout.offHand] = [
      f.row.loadout.offHand,
      f.row.loadout.mainHand,
    ];
    expect(
      characterStats(f.row, f.snapshot, f.catalog)
        .accuracy.filter((s) => s.stat === Stat.StatExpertise)
        .map((s) => s.effective),
    ).toEqual([22, 22 + expertise]);
  });
  it("does not reapply a racial already included for both weapons or a single weapon", () => {
    for (const offhand of [undefined, WeaponType.WeaponTypeAxe]) {
      const f = armed(Race.RaceOrc, WeaponType.WeaponTypeAxe, offhand);
      f.row.stats![Stat.StatExpertise] = 26 * r.expertise;
      const results = characterStats(
        f.row,
        f.snapshot,
        f.catalog,
      ).accuracy.filter((s) => s.stat === Stat.StatExpertise);
      expect(results).toHaveLength(1);
      expect(results[0].effective).toBeCloseTo(26);
    }
  });
  it("includes the Vengeance glyph only with the selected Vengeance seal", () => {
    const f = fixture("retribution_paladin");
    const player = f.snapshot.settings.player!;
    if (player.spec.oneofKind !== "retributionPaladin")
      throw new Error("Missing paladin options");
    player.spec.retributionPaladin.options!.seal = PaladinSeal.Vengeance;
    player.glyphs!.major1 = PaladinMajorGlyph.GlyphOfSealOfVengeance;
    f.row.stats![Stat.StatExpertise] = 16 * r.expertise;
    expect(cap(f, "expertise").effective).toBeCloseTo(26);
    player.spec.retributionPaladin.options!.seal = PaladinSeal.Command;
    expect(cap(f, "expertise").effective).toBeCloseTo(16);
  });
});

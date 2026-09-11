import { getCatalog, type Catalog } from "@/domain/equipment/catalog";
import type { SetRow, Snapshot } from "@/domain/top-gear/model";
import {
  Race,
  Stat,
  TristateEffect,
  WeaponType,
} from "@/generated/wotlk/common";
import { PaladinMajorGlyph, PaladinSeal } from "@/generated/wotlk/paladin";
import { getSpec } from "@/features/settings/registry";
import { readTalents, talentPoints } from "@/features/settings/talents";
import {
  includedTalentBonuses,
  type TalentStatBonus,
} from "./talent-stat-bonuses";

// See docs/design/character-stat-caps.md. These conversions match the pinned
// engine, whose finalStats already include passive talents and party buffs.
export const ratingConversions = {
  meleeHit: 32.789989,
  spellHit: 26.231993,
  expertise: 8.197496,
  armorPenetration: 13.99,
  crit: 45.905987,
  haste: 32.789989,
};
const casterModules = new Set([
  "balance_druid",
  "elemental_shaman",
  "mage",
  "shadow_priest",
  "smite_priest",
  "warlock",
]);
const spellHitModules = new Set([
  ...casterModules,
  "deathknight",
  "enhancement_shaman",
  "retribution_paladin",
  "rogue",
]);

export function primaryStats(specModule: string): Stat[] {
  if (casterModules.has(specModule)) {
    return [
      Stat.StatIntellect,
      ...(specModule === "elemental_shaman" ? [] : [Stat.StatSpirit]),
      Stat.StatSpellPower,
      Stat.StatSpellCrit,
      Stat.StatSpellHaste,
    ];
  }
  if (specModule === "hunter") {
    return [
      Stat.StatAgility,
      Stat.StatIntellect,
      Stat.StatRangedAttackPower,
      Stat.StatArmorPenetration,
      Stat.StatMeleeCrit,
      Stat.StatMeleeHaste,
    ];
  }
  return [
    Stat.StatStrength,
    Stat.StatAgility,
    ...(["enhancement_shaman", "retribution_paladin"].includes(specModule)
      ? [Stat.StatIntellect]
      : []),
    Stat.StatAttackPower,
    Stat.StatArmorPenetration,
    Stat.StatMeleeCrit,
    Stat.StatMeleeHaste,
  ];
}

export function armorPenetrationPercent(rating: number) {
  return Math.max(
    0,
    Math.min(100, rating / ratingConversions.armorPenetration),
  );
}

export type CapPresentation = {
  label:
    | "melee"
    | "ranged"
    | "spell"
    | "expertise"
    | "expertise-mh"
    | "expertise-oh";
  context:
    | "ranged"
    | "special"
    | "dualWield"
    | "spells"
    | "poisons"
    | "arcane"
    | "frostfire"
    | "shadow"
    | "front"
    | "behind";
  autoAttackCap?: number;
  bonuses: {
    kind:
      | "debuff"
      | "arcaneFocus"
      | "frostfirePrecision"
      | "shadowFocus"
      | "elementalPrecision"
      | "racial"
      | "vengeance";
    amount: number;
  }[];
};
export type StatCap = {
  talentBonuses?: TalentStatBonus[];
  presentation: CapPresentation;
  id: string;
  stat: Stat;
  label: string;
  rating: number;
  effective: number;
  unit: string;
  cap: number;
  difference: number;
  capped: boolean;
  context: string;
  bonuses: string[];
};
function capResult(
  row: SetRow,
  id: string,
  stat: Stat,
  label: string,
  cap: number,
  conversion: number,
  unit: string,
  context: string,
  bonus = 0,
  bonuses: string[] = [],
  presentation: CapPresentation,
): StatCap {
  const rating = row.stats?.[stat] ?? 0;
  const effective = rating / conversion + bonus;
  const difference = (effective - cap) * conversion;
  return {
    id,
    presentation,
    stat,
    label,
    rating,
    effective,
    unit,
    cap,
    difference,
    capped: difference >= -0.000001,
    context,
    bonuses,
  };
}

export function capDifferenceLabel(cap: StatCap) {
  if (Math.abs(cap.difference) < 0.000001) return "At cap";
  // Never display a rounded zero next to “below cap”. One more whole rating
  // is needed even for a fractional deficit.
  const amount =
    cap.difference < 0
      ? Math.ceil(Math.abs(cap.difference) - 0.000001)
      : Math.floor(cap.difference + 0.000001);
  return `${amount || "<1"} rating ${cap.capped ? "above" : "below"} cap`;
}

function racialExpertise(
  race: Race | undefined,
  weapon: WeaponType | undefined,
) {
  if (
    race === Race.RaceHuman &&
    [WeaponType.WeaponTypeSword, WeaponType.WeaponTypeMace].includes(weapon!)
  )
    return 3;
  if (race === Race.RaceDwarf && weapon === WeaponType.WeaponTypeMace) return 5;
  if (
    race === Race.RaceOrc &&
    [WeaponType.WeaponTypeAxe, WeaponType.WeaponTypeFist].includes(weapon!)
  )
    return 5;
  return 0;
}

export function characterStats(
  row: SetRow,
  snapshot: Snapshot,
  catalog: Catalog = getCatalog(snapshot.itemVersion),
) {
  const specModule = getSpec(snapshot.specId).module;
  const player = snapshot.settings.player;
  const talents = player ? readTalents(snapshot) : {};
  const points = talentPoints(snapshot);
  const caster = casterModules.has(specModule);
  const hunter = specModule === "hunter";
  // Engine target tables assume level 80. Missing target level defaults to a raid boss.
  const targetLevel = snapshot.settings.encounter?.targets[0]?.level || 83;
  const levelIndex = Math.max(0, Math.min(3, targetLevel - 80));
  const meleeCap = [5, 5.5, 6, 8][levelIndex];
  const spellCap = [4, 5, 6, 17][levelIndex];
  const expertiseCap =
    (player?.inFrontOfTarget ? [5, 5.5, 6, 14] : [5, 5.5, 6, 6.5])[levelIndex] *
    4;
  const weapon = (slot: "mainHand" | "offHand") => {
    const item = snapshot.inventory.find(
      (item) => item.instanceId === row.loadout[slot],
    );
    return item ? catalog.items.get(item.itemId)?.weaponType : undefined;
  };
  const mh = weapon("mainHand"),
    oh = weapon("offHand");
  const hasOffhand =
    oh !== undefined &&
    oh !== WeaponType.WeaponTypeUnknown &&
    oh !== WeaponType.WeaponTypeShield &&
    oh !== WeaponType.WeaponTypeOffHand;
  const accuracy: StatCap[] = [];
  if (!caster) {
    accuracy.push(
      capResult(
        row,
        "melee",
        Stat.StatMeleeHit,
        hunter ? "Ranged hit" : "Melee hit",
        meleeCap,
        ratingConversions.meleeHit,
        "% hit",
        hunter
          ? "Ranged attacks"
          : hasOffhand
            ? `Special attacks · auto-attack cap ${meleeCap + 19}%`
            : "Special attacks",
        0,
        [],
        {
          label: hunter ? "ranged" : "melee",
          context: hunter ? "ranged" : hasOffhand ? "dualWield" : "special",
          autoAttackCap: meleeCap + 19,
          bonuses: [],
        },
      ),
    );
  }
  if (spellHitModules.has(specModule)) {
    const debuffs = snapshot.settings.debuffs;
    const configuredDebuff =
      debuffs?.misery ||
      debuffs?.faerieFire === TristateEffect.TristateEffectImproved
        ? 3
        : 0;
    // Own debuffs only apply while maintained; expose this assumption beside the cap.
    const ownDebuff =
      specModule === "shadow_priest"
        ? (talents.misery ?? 0)
        : specModule === "balance_druid"
          ? (talents.improvedFaerieFire ?? 0)
          : 0;
    const hitDebuff = Math.max(configuredDebuff, ownDebuff);
    const bonuses: string[] = hitDebuff
      ? [`+${hitDebuff}% while Misery / Improved Faerie Fire is active`]
      : [];
    const presentation: CapPresentation = {
      label: "spell",
      context: specModule === "rogue" ? "poisons" : "spells",
      bonuses: hitDebuff ? [{ kind: "debuff", amount: hitDebuff }] : [],
    };
    let schoolBonus = 0;
    let context = specModule === "rogue" ? "Poisons" : "Spells";
    if (
      specModule === "mage" &&
      (points[0] ?? 0) > Math.max(points[1] ?? 0, points[2] ?? 0)
    ) {
      schoolBonus = talents.arcaneFocus ?? 0;
      context = "Arcane spells";
      presentation.context = "arcane";
      if (schoolBonus)
        presentation.bonuses.push({ kind: "arcaneFocus", amount: schoolBonus });
      if (schoolBonus) bonuses.push(`+${schoolBonus}% Arcane Focus`);
    } else if (
      specModule === "mage" &&
      (points[1] ?? 0) > Math.max(points[0] ?? 0, points[2] ?? 0) &&
      (talents.iceShards ?? 0) > 0
    ) {
      // The pinned automatic rotation chooses Frostfire for this Fire build.
      // Frostfire's two schools double-dip Precision in the pinned engine.
      schoolBonus = talents.precision ?? 0;
      context = "Frostfire Bolt";
      presentation.context = "frostfire";
      if (schoolBonus)
        presentation.bonuses.push({
          kind: "frostfirePrecision",
          amount: schoolBonus,
        });
      if (schoolBonus)
        bonuses.push(
          `+${schoolBonus}% additional Precision for Frostfire only`,
        );
    } else if (specModule === "shadow_priest") {
      schoolBonus = talents.shadowFocus ?? 0;
      context = "Shadow spells";
      presentation.context = "shadow";
      if (schoolBonus)
        presentation.bonuses.push({ kind: "shadowFocus", amount: schoolBonus });
      if (schoolBonus) bonuses.push(`+${schoolBonus}% Shadow Focus`);
    } else if (
      specModule === "elemental_shaman" ||
      specModule === "enhancement_shaman"
    ) {
      schoolBonus = talents.elementalPrecision ?? 0;
      if (schoolBonus)
        presentation.bonuses.push({
          kind: "elementalPrecision",
          amount: schoolBonus,
        });
      if (schoolBonus) bonuses.push(`+${schoolBonus}% Elemental Precision`);
    }
    accuracy.push(
      capResult(
        row,
        "spell",
        Stat.StatSpellHit,
        "Spell hit",
        spellCap,
        ratingConversions.spellHit,
        "% hit",
        context,
        hitDebuff + schoolBonus,
        bonuses,
        presentation,
      ),
    );
  }
  if (!caster && !hunter) {
    const mhRacial = racialExpertise(player?.race, mh),
      ohRacial = racialExpertise(player?.race, oh);
    // The engine stores racials in finalStats if every active weapon qualifies.
    // With mixed weapons the bonus lives on each weapon's spells instead.
    const racialInStats = mhRacial > 0 && (!hasOffhand || ohRacial > 0);
    const glyphs = player?.glyphs;
    const vengeance =
      player?.spec?.oneofKind === "retributionPaladin" &&
      player.spec.retributionPaladin.options?.seal === PaladinSeal.Vengeance &&
      [glyphs?.major1, glyphs?.major2, glyphs?.major3].includes(
        PaladinMajorGlyph.GlyphOfSealOfVengeance,
      );
    const sealBonus = vengeance ? 10 : 0;
    const context = player?.inFrontOfTarget
      ? "Dodge & parry cap · from the front"
      : "Dodge cap · from behind";
    const hands =
      hasOffhand && mhRacial !== ohRacial
        ? [
            { id: "expertise-mh", label: "Expertise · MHand", bonus: mhRacial },
            { id: "expertise-oh", label: "Expertise · OHand", bonus: ohRacial },
          ]
        : [{ id: "expertise", label: "Expertise", bonus: mhRacial }];
    for (const hand of hands) {
      const racial = racialInStats ? 0 : hand.bonus;
      const bonuses = [
        ...(racial ? [`+${racial} weapon racial expertise`] : []),
        ...(vengeance ? ["+10 while Seal of Vengeance is active"] : []),
      ];
      accuracy.push(
        capResult(
          row,
          hand.id,
          Stat.StatExpertise,
          hand.label,
          expertiseCap,
          ratingConversions.expertise,
          " expertise",
          context,
          racial + sealBonus,
          bonuses,
          {
            label: hand.id as CapPresentation["label"],
            context: player?.inFrontOfTarget ? "front" : "behind",
            bonuses: [
              ...(racial ? [{ kind: "racial" as const, amount: racial }] : []),
              ...(vengeance
                ? [{ kind: "vengeance" as const, amount: 10 }]
                : []),
            ],
          },
        ),
      );
    }
  }
  const talentBonuses = includedTalentBonuses(
    snapshot,
    talents,
    specModule,
    mh,
    oh,
  );
  return {
    primary: primaryStats(specModule),
    accuracy: accuracy.map((cap) => ({
      ...cap,
      talentBonuses: talentBonuses.filter((bonus) => bonus.stat === cap.stat),
    })),
    targetLevel,
    talentBonuses,
  };
}

export type CombinationStat = {
  talentBonuses?: TalentStatBonus[];
  presentation:
    | { kind: "cap"; cap: StatCap }
    | { kind: "armorPenetration" }
    | { kind: "rating"; stat: Stat; ranged: boolean };
  id: string;
  label: string;
  percent: number;
  description: string;
  capped?: boolean;
};

/** Percentages from this combination's results, never from the selected row. */
export function combinationStats(
  row: SetRow,
  snapshot: Snapshot,
): CombinationStat[] {
  if (!row.stats?.some((value) => Number.isFinite(value) && value !== 0))
    return [];
  const { primary, accuracy, talentBonuses } = characterStats(row, snapshot);
  const stats: CombinationStat[] = accuracy.map((cap) => {
    const expertise = cap.stat === Stat.StatExpertise;
    return {
      id: cap.id,
      presentation: { kind: "cap", cap },
      label: cap.label,
      percent: expertise ? cap.effective / 4 : cap.effective,
      capped: cap.capped,
      talentBonuses: cap.talentBonuses,
      description: [
        expertise
          ? `${cap.effective.toFixed(2)} expertise; percentage reduces dodge/parry chance`
          : cap.label,
        capDifferenceLabel(cap),
        cap.context,
        ...cap.bonuses,
      ].join(" · "),
    };
  });
  if (primary.includes(Stat.StatArmorPenetration)) {
    stats.push({
      id: "armor-penetration",
      talentBonuses: talentBonuses.filter(
        (bonus) => bonus.stat === Stat.StatArmorPenetration,
      ),
      presentation: { kind: "armorPenetration" },
      label: "Armor pen",
      percent: armorPenetrationPercent(
        row.stats[Stat.StatArmorPenetration] ?? 0,
      ),
      description:
        "Armor Penetration from rating; excludes armor debuffs and temporary procs",
    });
  }
  for (const [stat, label, conversion] of [
    [Stat.StatSpellHaste, "Spell haste", ratingConversions.haste],
    [Stat.StatSpellCrit, "Spell crit", ratingConversions.crit],
    [
      Stat.StatMeleeCrit,
      primary.includes(Stat.StatRangedAttackPower)
        ? "Ranged crit"
        : "Melee crit",
      ratingConversions.crit,
    ],
  ] as const) {
    if (primary.includes(stat))
      stats.push({
        id: String(stat),
        talentBonuses: talentBonuses.filter((bonus) => bonus.stat === stat),
        presentation: {
          kind: "rating",
          stat,
          ranged: primary.includes(Stat.StatRangedAttackPower),
        },
        label,
        percent: (row.stats[stat] ?? 0) / conversion,
        description: `${label} from reported rating; excludes attack-specific bonuses, target modifiers${stat === Stat.StatSpellHaste ? " and haste multipliers" : ""}`,
      });
  }
  return stats;
}

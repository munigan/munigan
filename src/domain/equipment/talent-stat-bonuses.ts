import { Class, Stat, WeaponType } from "@/generated/wotlk/common";
import { Warlock_Options_WeaponImbue } from "@/generated/wotlk/warlock";
import type { Snapshot } from "@/domain/top-gear/model";

export type TalentStatBonus = {
  talent: string;
  stat: Stat;
  amount: number;
  unit: "percent" | "expertise" | "rating";
};

/**
 * Attribution only: these bonuses are already in the simulator's finalStats.
 * Match the pinned engine's class talent files, including its weapon rules.
 * Spell-scoped cap bonuses are handled separately by characterStats.
 * Talent names follow the English game names used by the settings UI.
 */
export function includedTalentBonuses(
  snapshot: Snapshot,
  talents: Record<string, number>,
  specModule: string,
  mainHand: WeaponType | undefined,
  offHand: WeaponType | undefined,
): TalentStatBonus[] {
  const bonuses: TalentStatBonus[] = [];
  const player = snapshot.settings.player;
  const weapon = (type: WeaponType | undefined) =>
    type !== undefined &&
    ![
      WeaponType.WeaponTypeUnknown,
      WeaponType.WeaponTypeShield,
      WeaponType.WeaponTypeOffHand,
    ].includes(type);
  const add = (
    field: string,
    name: string,
    stats: Stat | Stat[],
    perRank = 1,
    unit?: TalentStatBonus["unit"],
  ) => {
    const rank = talents[field] ?? 0;
    if (!Number.isFinite(rank) || rank <= 0) return;
    for (const stat of Array.isArray(stats) ? stats : [stats])
      bonuses.push({
        talent: name,
        stat,
        amount: rank * perRank,
        unit: unit ?? (stat === Stat.StatExpertise ? "expertise" : "percent"),
      });
  };
  const bothCrit = [Stat.StatMeleeCrit, Stat.StatSpellCrit];
  switch (player?.class) {
    case Class.ClassDeathknight:
      add("tundraStalker", "Tundra Stalker", Stat.StatExpertise);
      add("rageOfRivendare", "Rage of Rivendare", Stat.StatExpertise);
      add(
        "veteranOfTheThirdWar",
        "Veteran of the Third War",
        Stat.StatExpertise,
        2,
      );
      if (weapon(mainHand) && weapon(offHand))
        add("nervesOfColdSteel", "Nerves of Cold Steel", Stat.StatMeleeHit);
      add("virulence", "Virulence", Stat.StatSpellHit);
      add("bloodGorged", "Blood Gorged", Stat.StatArmorPenetration, 2);
      add("darkConviction", "Dark Conviction", bothCrit);
      if (talents.cryptFever > 0)
        add("ebonPlaguebringer", "Ebon Plaguebringer", bothCrit);
      break;
    case Class.ClassWarrior:
      add("precision", "Precision", Stat.StatMeleeHit);
      add("strengthOfArms", "Strength of Arms", Stat.StatExpertise, 2);
      add("vitality", "Vitality", Stat.StatExpertise, 2);
      add("cruelty", "Cruelty", Stat.StatMeleeCrit);
      if (
        mainHand === WeaponType.WeaponTypeAxe ||
        mainHand === WeaponType.WeaponTypePolearm
      )
        add(
          "poleaxeSpecialization",
          "Poleaxe Specialization",
          Stat.StatMeleeCrit,
        );
      // Pinned warrior/talents.go compares against ProcMaskEmpty, so this
      // rating bonus is applied even without a mace. Describe the actual total.
      add(
        "maceSpecialization",
        "Mace Specialization",
        Stat.StatArmorPenetration,
        3,
      );
      break;
    case Class.ClassRogue:
      add("precision", "Precision", [Stat.StatMeleeHit, Stat.StatSpellHit]);
      add("weaponExpertise", "Weapon Expertise", Stat.StatExpertise, 5);
      add("serratedBlades", "Serrated Blades", Stat.StatArmorPenetration, 3);
      add("malice", "Malice", Stat.StatMeleeCrit);
      if (
        mainHand === WeaponType.WeaponTypeDagger ||
        mainHand === WeaponType.WeaponTypeFist
      )
        add("closeQuartersCombat", "Close Quarters Combat", Stat.StatMeleeCrit);
      if (
        mainHand === WeaponType.WeaponTypeMace ||
        offHand === WeaponType.WeaponTypeMace
      )
        add(
          "maceSpecialization",
          "Mace Specialization",
          Stat.StatArmorPenetration,
          3,
        );
      break;
    case Class.ClassPaladin:
      add("conviction", "Conviction", bothCrit);
      add("sanctityOfBattle", "Sanctity of Battle", bothCrit);
      add("combatExpertise", "Combat Expertise", Stat.StatExpertise, 2);
      add("combatExpertise", "Combat Expertise", bothCrit, 2);
      break;
    case Class.ClassHunter:
      add("focusedAim", "Focused Aim", Stat.StatMeleeHit);
      add("killerInstinct", "Killer Instinct", Stat.StatMeleeCrit);
      add("masterMarksman", "Master Marksman", Stat.StatMeleeCrit);
      break;
    case Class.ClassMage:
      add("precision", "Precision", Stat.StatSpellHit);
      add("arcaneInstability", "Arcane Instability", Stat.StatSpellCrit);
      add("pyromaniac", "Pyromaniac", Stat.StatSpellCrit);
      break;
    case Class.ClassPriest:
      add("focusedWill", "Focused Will", Stat.StatSpellCrit);
      break;
    case Class.ClassShaman:
      add("unleashedRage", "Unleashed Rage", Stat.StatExpertise, 3);
      if (weapon(offHand))
        add(
          "dualWieldSpecialization",
          "Dual Wield Specialization",
          Stat.StatMeleeHit,
          2,
        );
      add("thunderingStrikes", "Thundering Strikes", bothCrit);
      add(
        "blessingOfTheEternals",
        "Blessing of the Eternals",
        Stat.StatSpellCrit,
        2,
      );
      break;
    case Class.ClassDruid:
      add("balanceOfPower", "Balance of Power", Stat.StatSpellHit, 2);
      add("primalPrecision", "Primal Precision", Stat.StatExpertise, 5);
      add("naturalPerfection", "Natural Perfection", Stat.StatSpellCrit);
      if (snapshot.settings.debuffs?.faerieFire)
        add("improvedFaerieFire", "Improved Faerie Fire", Stat.StatSpellCrit);
      if (specModule === "feral_druid") {
        add("sharpenedClaws", "Sharpened Claws", Stat.StatMeleeCrit, 2);
        add("masterShapeshifter", "Master Shapeshifter", Stat.StatMeleeCrit, 2);
      }
      break;
    case Class.ClassWarlock:
      add("suppression", "Suppression", Stat.StatSpellHit);
      add("backlash", "Backlash", Stat.StatSpellCrit);
      add("demonicTactics", "Demonic Tactics", bothCrit, 2);
      if (player.spec.oneofKind === "warlock") {
        const imbue = player.spec.warlock.options?.weaponImbue;
        // Only the talent's increase, excluding the stone's base 49/60 rating.
        if (imbue === Warlock_Options_WeaponImbue.GrandFirestone)
          add(
            "masterConjuror",
            "Master Conjuror",
            Stat.StatSpellCrit,
            49 * 1.5,
            "rating",
          );
        if (imbue === Warlock_Options_WeaponImbue.GrandSpellstone)
          add(
            "masterConjuror",
            "Master Conjuror",
            Stat.StatSpellHaste,
            60 * 1.5,
            "rating",
          );
      }
      break;
  }
  return bonuses;
}

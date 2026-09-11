import type { SpecChoice } from "./registry";

// Presentation only: stable simulator IDs, talents, glyphs and settings stay intact.
const presets: Record<string, { key: string; icon: string; order: number }> = {
  "balance_druid:Phase1Talents": {
    key: "balancePhase1",
    icon: "spell_nature_starfall",
    order: 0,
  },
  "balance_druid:Phase2Talents": {
    key: "balancePhase2",
    icon: "spell_nature_starfall",
    order: 1,
  },
  "balance_druid:Phase3Talents": {
    key: "balancePhase3",
    icon: "spell_nature_starfall",
    order: 2,
  },
  "balance_druid:Phase4Talents": {
    key: "balancePhase4",
    icon: "spell_nature_starfall",
    order: 3,
  },
  "feral_druid:StandardTalents": {
    key: "feral",
    icon: "ability_druid_catform",
    order: 4,
  },
  "elemental_shaman:StandardTalents": {
    key: "elemental",
    icon: "spell_nature_lightning",
    order: 5,
  },
  "enhancement_shaman:StandardTalents": {
    key: "enhancement",
    icon: "spell_nature_lightningshield",
    order: 6,
  },
  "enhancement_shaman:Phase3Talents": {
    key: "enhancementPhase3",
    icon: "spell_nature_lightningshield",
    order: 7,
  },
  "hunter:BeastMasteryTalents": {
    key: "beastMastery",
    icon: "ability_hunter_beasttaming",
    order: 8,
  },
  "hunter:MarksmanTalents": {
    key: "marksmanship",
    icon: "ability_marksmanship",
    order: 9,
  },
  "hunter:SurvivalTalents": {
    key: "survival",
    icon: "ability_hunter_swiftstrike",
    order: 10,
  },
  "mage:ArcaneTalents": {
    key: "arcane",
    icon: "spell_holy_magicalsentry",
    order: 11,
  },
  "mage:FireTalents": {
    key: "fire",
    icon: "spell_fire_firebolt02",
    order: 12,
  },
  "mage:Phase3FireTalents": {
    key: "firePhase3",
    icon: "spell_fire_firebolt02",
    order: 13,
  },
  "mage:FrostfireTalents": {
    key: "frostfire",
    icon: "spell_fire_firebolt02",
    order: 14,
  },
  "mage:FrostTalents": {
    key: "frostMage",
    icon: "spell_frost_frostbolt02",
    order: 15,
  },
  "rogue:AssassinationTalents137": {
    key: "assassination137",
    icon: "ability_rogue_eviscerate",
    order: 16,
  },
  "rogue:AssassinationTalents182": {
    key: "assassination182",
    icon: "ability_rogue_eviscerate",
    order: 17,
  },
  "rogue:AssassinationTalentsBF": {
    key: "assassinationBladeFlurry",
    icon: "ability_rogue_eviscerate",
    order: 18,
  },
  "rogue:CombatCQCTalents": {
    key: "combatFists",
    icon: "ability_backstab",
    order: 19,
  },
  "rogue:CombatHackTalents": {
    key: "combatSwords",
    icon: "ability_backstab",
    order: 20,
  },
  "rogue:SubtletyTalents": {
    key: "subtlety",
    icon: "ability_stealth",
    order: 21,
  },
  "rogue:HemoSubtletyTalents": {
    key: "hemorrhage",
    icon: "ability_stealth",
    order: 22,
  },
  "retribution_paladin:AuraMasteryTalents": {
    key: "retributionAura",
    icon: "spell_holy_auraoflight",
    order: 23,
  },
  "retribution_paladin:DivineSacTalents": {
    key: "retributionSacrifice",
    icon: "spell_holy_auraoflight",
    order: 24,
  },
  "shadow_priest:StandardTalents": {
    key: "shadow",
    icon: "spell_shadow_shadowwordpain",
    order: 25,
  },
  "shadow_priest:EnlightenmentTalents": {
    key: "shadowDiscipline",
    icon: "spell_shadow_shadowwordpain",
    order: 26,
  },
  "smite_priest:StandardTalents": {
    key: "smite",
    icon: "spell_holy_wordfortitude",
    order: 27,
  },
  "warlock:AfflictionTalents": {
    key: "affliction",
    icon: "spell_shadow_deathcoil",
    order: 28,
  },
  "warlock:DemonologyTalents": {
    key: "demonology",
    icon: "spell_shadow_metamorphosis",
    order: 29,
  },
  "warlock:DestructionTalents": {
    key: "destruction",
    icon: "spell_shadow_rainoffire",
    order: 30,
  },
  "warrior:ArmsTalents": {
    key: "arms",
    icon: "ability_warrior_savageblow",
    order: 31,
  },
  "warrior:FuryTalents": {
    key: "fury",
    icon: "ability_warrior_innerrage",
    order: 32,
  },
  "deathknight:BloodTalents": {
    key: "blood",
    icon: "spell_deathknight_bloodpresence",
    order: 33,
  },
  "deathknight:FrostTalents": {
    key: "frostBlood",
    icon: "spell_deathknight_frostpresence",
    order: 34,
  },
  "deathknight:FrostUnholyTalents": {
    key: "frostUnholy",
    icon: "spell_deathknight_frostpresence",
    order: 35,
  },
  "deathknight:Unholy2HTalents": {
    key: "unholyTwoHanded",
    icon: "spell_deathknight_unholypresence",
    order: 36,
  },
  "deathknight:UnholyAoeTalents": {
    key: "unholyArea",
    icon: "spell_deathknight_unholypresence",
    order: 37,
  },
  "deathknight:UnholyDualWieldSSTalents": {
    key: "unholyDualScourge",
    icon: "spell_deathknight_unholypresence",
    order: 38,
  },
  "deathknight:UnholyDualWieldTalents": {
    key: "unholyDual",
    icon: "spell_deathknight_unholypresence",
    order: 39,
  },
};

const treeNames: Record<string, readonly string[]> = {
  Deathknight: ["Blood", "Frost", "Unholy"],
  Druid: ["Balance", "Feral Combat", "Restoration"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Mage: ["Arcane", "Fire", "Frost"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Rogue: ["Assassination", "Combat", "Subtlety"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Warrior: ["Arms", "Fury", "Protection"],
};

export function presetPresentation(spec: SpecChoice) {
  const metadata = presets[spec.id];
  const trees = spec.talents.talentsString.split("-");
  const points = Array.from({ length: 3 }, (_, index) =>
    [...(trees[index] ?? "")].reduce((sum, rank) => sum + Number(rank), 0),
  );
  return {
    key: metadata?.key,
    icon: metadata?.icon ?? "inv_misc_questionmark",
    order: metadata?.order ?? Number.MAX_SAFE_INTEGER,
    points: points.join("/"),
    treeNames: treeNames[spec.className] ?? [],
  };
}

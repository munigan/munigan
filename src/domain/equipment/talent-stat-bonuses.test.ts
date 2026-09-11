import { expect, it } from "vitest";
import { Class, Stat, WeaponType } from "@/generated/wotlk/common";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import type { Snapshot } from "@/domain/top-gear/model";
import { includedTalentBonuses } from "./talent-stat-bonuses";

const W = WeaponType;
function snapshot(module: string) {
  const spec = listSpecs().find((s) => s.module === module)!;
  return { specId: spec.id, settings: defaultSettings(spec.id) } as Snapshot;
}

it("attributes partial DK ranks individually and excludes unselected and proc talents", () => {
  const s = snapshot("deathknight");
  const bonuses = includedTalentBonuses(
    s,
    {
      tundraStalker: 2,
      rageOfRivendare: 3,
      veteranOfTheThirdWar: 1,
      killingMachine: 5,
      bloodGorged: 0,
    },
    "deathknight",
    W.WeaponTypeSword,
    undefined,
  );
  expect(bonuses).toEqual([
    {
      talent: "Tundra Stalker",
      stat: Stat.StatExpertise,
      amount: 2,
      unit: "expertise",
    },
    {
      talent: "Rage of Rivendare",
      stat: Stat.StatExpertise,
      amount: 3,
      unit: "expertise",
    },
    {
      talent: "Veteran of the Third War",
      stat: Stat.StatExpertise,
      amount: 2,
      unit: "expertise",
    },
  ]);
});

it.each([
  undefined,
  W.WeaponTypeShield,
  W.WeaponTypeOffHand,
  W.WeaponTypeUnknown,
])("does not attribute dual-wield hit with offhand %s", (offHand) => {
  const s = snapshot("deathknight");
  expect(
    includedTalentBonuses(
      s,
      { nervesOfColdSteel: 3 },
      "deathknight",
      W.WeaponTypeSword,
      offHand,
    ),
  ).toEqual([]);
  expect(
    includedTalentBonuses(
      snapshot("enhancement_shaman"),
      { dualWieldSpecialization: 3 },
      "enhancement_shaman",
      W.WeaponTypeAxe,
      offHand,
    ),
  ).toEqual([]);
});

it("uses the chosen weapons and class for talent bonuses", () => {
  const s = snapshot("deathknight");
  expect(
    includedTalentBonuses(
      s,
      { nervesOfColdSteel: 3 },
      "deathknight",
      W.WeaponTypeSword,
      W.WeaponTypeSword,
    ),
  ).toMatchObject([{ stat: Stat.StatMeleeHit, amount: 3 }]);
  const rogue = snapshot("rogue");
  expect(
    includedTalentBonuses(
      rogue,
      { maceSpecialization: 5, closeQuartersCombat: 5 },
      "rogue",
      W.WeaponTypeSword,
      W.WeaponTypeDagger,
    ),
  ).toEqual([]);
  expect(
    includedTalentBonuses(
      rogue,
      { maceSpecialization: 5, closeQuartersCombat: 5 },
      "rogue",
      W.WeaponTypeDagger,
      W.WeaponTypeMace,
    ),
  ).toMatchObject([
    { talent: "Close Quarters Combat", stat: Stat.StatMeleeCrit, amount: 5 },
    {
      talent: "Mace Specialization",
      stat: Stat.StatArmorPenetration,
      amount: 15,
    },
  ]);
  s.settings.player!.class = Class.ClassWarrior;
  expect(
    includedTalentBonuses(
      s,
      { tundraStalker: 5, precision: 2 },
      "warrior",
      W.WeaponTypeSword,
      undefined,
    ),
  ).toMatchObject([
    { talent: "Precision", stat: Stat.StatMeleeHit, amount: 2 },
  ]);
});

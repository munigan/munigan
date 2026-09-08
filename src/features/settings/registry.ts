import raw from "../../../data/wotlk/presets.json";
import { IndividualSimSettings, SavedTalents } from "@/generated/wotlk/ui";
import {
  Class,
  Race,
  Profession,
  Encounter,
  Target,
  Stat,
  MobType,
} from "@/generated/wotlk/common";
import { Player } from "@/generated/wotlk/api";
import type { JsonObject } from "@protobuf-ts/runtime";
export type ModulePreset = {
  name: string;
  data?: SavedTalents;
  rotation?: { rotation?: unknown };
  gear?: unknown;
  conditions?: { talentTree?: number; talentTrees?: number[] };
};
type Variant = {
  defaultName: string;
  talents: SavedTalents;
  specOptions: unknown;
  consumes: unknown;
  defaultFactionRaces: Record<string, number>;
  defaultGear: Record<string, Record<string, unknown>>;
};
type ModuleData = {
  defaults: Record<string, unknown>;
  variants: Variant[];
  presets: Record<string, ModulePreset>;
};
export const modules = raw as unknown as Record<string, ModuleData>;
const classNames: Record<string, string> = {
  balance_druid: "Druid",
  feral_druid: "Druid",
  elemental_shaman: "Shaman",
  enhancement_shaman: "Shaman",
  hunter: "Hunter",
  mage: "Mage",
  rogue: "Rogue",
  retribution_paladin: "Paladin",
  shadow_priest: "Priest",
  smite_priest: "Priest",
  warlock: "Warlock",
  warrior: "Warrior",
  deathknight: "Deathknight",
};
export type SpecChoice = {
  id: string;
  module: string;
  name: string;
  classId: Class;
  className: string;
  talents: SavedTalents;
  options: unknown;
  consumes: unknown;
  race: Race;
};
export function listSpecs(): SpecChoice[] {
  return Object.entries(modules).flatMap(([module, m]) =>
    Object.entries(m.presets)
      .filter(([, p]) => p.data?.talentsString !== undefined)
      .map(([key, p]) => {
        const variant = m.variants.find(
          (v) => v.talents.talentsString === p.data!.talentsString,
        );
        const name = classNames[module];
        return {
          id: `${module}:${key}`,
          module,
          name: p.name,
          classId: Class[`Class${name}` as keyof typeof Class] as Class,
          className: name,
          talents: p.data!,
          options: variant?.specOptions ?? m.defaults.specOptions,
          consumes: variant?.consumes ?? m.defaults.consumes,
          race: ((variant ?? m.variants[0])?.defaultFactionRaces["1"] ??
            Race.RaceUnknown) as Race,
        };
      }),
  );
}
export function getSpec(id: string) {
  const spec = listSpecs().find((s) => s.id === id);
  if (!spec) throw new Error("Choose a supported DPS specialization");
  return spec;
}
export function defaultSettings(id: string): IndividualSimSettings {
  const spec = getSpec(id),
    d = modules[spec.module].defaults;
  const key = spec.module.replace(/_([a-z])/g, (_, s: string) =>
    s.toUpperCase(),
  );
  const player = Player.create({
    name: "Character",
    class: spec.classId,
    race: spec.race,
    talentsString: spec.talents.talentsString,
    glyphs: spec.talents.glyphs,
    profession1: Profession.ProfessionUnknown,
    profession2: Profession.ProfessionUnknown,
  });
  const json = Player.toJson(player) as JsonObject;
  json[key] = { options: spec.options } as JsonObject;
  player.spec = Player.fromJson(json).spec;
  const settings = IndividualSimSettings.create({ player });
  const internal = {
    raidBuffs: d.raidBuffs,
    partyBuffs: d.partyBuffs,
    debuffs: d.debuffs,
    player: {
      ...player,
      consumes: spec.consumes,
      buffs: d.individualBuffs,
      ...((d.other as object) ?? {}),
    },
  };
  const merged = IndividualSimSettings.create(
    internal as Parameters<typeof IndividualSimSettings.create>[0],
  );
  const stats = Array(35).fill(0);
  stats[Stat.StatArmor] = 10643;
  stats[Stat.StatAttackPower] = 805;
  stats[Stat.StatBlockValue] = 76;
  settings.player = merged.player;
  settings.raidBuffs = merged.raidBuffs;
  settings.partyBuffs = merged.partyBuffs;
  settings.debuffs = merged.debuffs;
  settings.encounter = Encounter.create({
    duration: 180,
    durationVariation: 5,
    executeProportion20: 0.2,
    executeProportion25: 0.25,
    executeProportion35: 0.35,
    targets: [
      Target.create({
        level: 83,
        mobType: MobType.MobTypeGiant,
        stats,
        swingSpeed: 1.5,
        minBaseDamage: 65000,
        parryHaste: true,
      }),
    ],
  });
  return settings;
}

import { it, expect } from "vitest";
import { parseExport, applyBagImport, resolveSnapshot } from "./parse-export";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
const character = {
  name: "Tester",
  class: "warrior",
  race: "Human",
  level: 80,
  talents: "32002301233-305053000520310053120500351",
  glyphs: { major: [], minor: [] },
  professions: [],
  gear: { items: [{ id: 50080, enchant: 0, gems: [0, 0] }] },
};
it.each(["Glyph of Enslave Demon", "Glyph of Subjugate Demon"])(
  "preserves the warlock minor glyph exported as %s",
  (name) => {
    const draft = parseExport(
      JSON.stringify({
        ...character,
        class: "warlock",
        glyphs: { major: [], minor: [name] },
      }),
      "character",
    );
    const settings = IndividualSimSettings.fromJson(draft.settingsJson);
    expect(settings.player?.glyphs?.minor1).toBe(43393);
    expect(settings.player?.glyphs?.minor2).toBe(0);
  },
);
it.each([
  { class: "warrior", name: "Glyph of Enslave Demon" },
  { class: "warlock", name: "Glyph of Not A Real Spell" },
])("rejects unknown or wrong-class glyphs: $name / $class", (input) => {
  expect(() =>
    parseExport(
      JSON.stringify({
        ...character,
        class: input.class,
        glyphs: { major: [], minor: [input.name] },
      }),
      "character",
    ),
  ).toThrow(/Unknown glyph/);
});
it("accepts the addon ammo slot without shifting or importing it as gear", () => {
  const ids = [
    48398, 47988, 48395, 47546, 48396, 47442, 47492, 47429, 48394, 47457, 47993,
    48007, 42987, 45931, 47446, 47446, 45296,
  ];
  for (const ammo of [{ id: 41584 }, null, { id: 0 }]) {
    const draft = parseExport(
      JSON.stringify({
        ...character,
        gear: { items: [...ids.map((id) => ({ id })), ammo] },
      }),
      "character",
    );
    expect(draft.inventory.map((item) => item.itemId)).toEqual(ids);
    expect(draft.inventory.at(-1)?.equippedSlot).toBe("ranged");
    expect(draft.inventory[14].instanceId).not.toBe(
      draft.inventory[15].instanceId,
    );
  }
});
it("still rejects addon exports beyond the equipment and ammo slots", () => {
  expect(() =>
    parseExport(
      JSON.stringify({
        ...character,
        gear: { items: Array.from({ length: 19 }, () => ({ id: 50080 })) },
      }),
      "character",
    ),
  ).toThrow(/Too many exported items/);
});
it("keeps two enhanced copies and replaces repeated bag snapshots", () => {
  const parsed = parseExport(
    JSON.stringify({
      items: [
        { id: 51212, enchant: 0, gems: [0] },
        { id: 51212, enchant: 3817, gems: [40111] },
      ],
    }),
    "bags",
  );
  expect(parsed.inventory.map((i) => i.enchantId)).toEqual([0, 3817]);
  expect(new Set(parsed.inventory.map((i) => i.instanceId)).size).toBe(2);
  const draft = parseExport(JSON.stringify(character), "character");
  const spec = listSpecs().find((s) => s.name === "Fury")!;
  const initial = resolveSnapshot(draft, spec.id).snapshot;
  const once = applyBagImport(initial, parsed.inventory),
    twice = applyBagImport(once, parsed.inventory);
  expect(twice.inventory).toEqual(once.inventory);
  expect(twice.inventory).toHaveLength(3);
  expect(twice.inventory[0].gemIds).toEqual([0, 0]);
});
it("rejects incompatible level and malformed input", () => {
  expect(() => parseExport("{", "character")).toThrow(/valid JSON/i);
  expect(() =>
    parseExport(JSON.stringify({ ...character, level: 90 }), "character"),
  ).toThrow(/80|Wrath/);
});
it("does not count preset gear as owned or overwrite explicit empty glyphs", () => {
  const draft = parseExport(JSON.stringify(character), "character");
  const spec = listSpecs().find((s) => s.name === "Fury")!;
  const { snapshot } = resolveSnapshot(draft, spec.id);
  expect(snapshot.inventory).toHaveLength(1);
  expect(snapshot.settings.player?.glyphs?.major1).toBe(0);
  expect(snapshot.settings.player?.talentsString).toBe(character.talents);
});
it("preserves a full profile explicit false and zero while changing encounter only", () => {
  const spec = listSpecs().find((s) => s.name === "Fury")!;
  const draft = parseExport(
    JSON.stringify({
      player: {
        name: "Profile",
        class: "ClassWarrior",
        race: "RaceHuman",
        equipment: character.gear,
        warrior: { options: { useRecklessness: false, startingRage: 0 } },
        talentsString: character.talents,
      },
      encounter: { duration: 120, targets: [{ level: 83 }] },
    }),
    "profile",
  );
  const { snapshot } = resolveSnapshot(draft, spec.id);
  const options = snapshot.settings.player?.spec;
  expect(options?.oneofKind).toBe("warrior");
  if (options?.oneofKind === "warrior")
    expect(options.warrior.options?.useRecklessness).toBe(false);
  expect(snapshot.settings.encounter?.duration).toBe(120);
});
it("keeps disabled values from full simulator JSON categories", () => {
  const id = listSpecs().find((s) => s.name === "Fury")!.id;
  const settings = defaultSettings(id);
  settings.player!.equipment = { items: [{ id: 44006, enchant: 0, gems: [] }] };
  settings.raidBuffs!.bloodlust = false;
  const { snapshot } = resolveSnapshot(
    parseExport(IndividualSimSettings.toJsonString(settings), "profile"),
    id,
  );
  expect(snapshot.settings.raidBuffs!.bloodlust).toBe(false);
});
it("preserves zero encounter variation and execute proportions in full JSON", () => {
  const id = listSpecs().find((s) => s.name === "Fury")!.id,
    settings = defaultSettings(id);
  settings.player!.equipment = { items: [{ id: 44006, enchant: 0, gems: [] }] };
  settings.encounter!.durationVariation = 0;
  settings.encounter!.executeProportion20 = 0;
  const { snapshot } = resolveSnapshot(
    parseExport(IndividualSimSettings.toJsonString(settings), "profile"),
    id,
  );
  expect(snapshot.settings.encounter!.durationVariation).toBe(0);
  expect(snapshot.settings.encounter!.executeProportion20).toBe(0);
});

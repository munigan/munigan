import { expect, it } from "vitest";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import type { Snapshot } from "@/domain/top-gear/model";
import { emptyLoadout } from "@/domain/top-gear/slots";
import { Profession } from "@/generated/wotlk/common";
import { prepareEnchants, withEnhancements } from "./enhancements";
import { simulationInput } from "@/server/simulator/evaluate";
import { loadoutKey } from "./enumerate";
import { validateLoadout } from "./validate";
import { getCatalog } from "./catalog";
import { enchantApplies } from "./validate";
import { itemSockets, extraSocketLabel } from "./sockets";
import { GemColor } from "@/generated/wotlk/common";

function fixture() {
  const spec = listSpecs().find((s) => s.module === "deathknight")!;
  const s: Snapshot = {
    id: "enchants",
    specId: spec.id,
    versions: {
      engine: "test",
      schema: "test",
      presets: "test",
      catalog: "test",
      optimizer: "test",
    },
    settings: defaultSettings(spec.id),
    equipped: emptyLoadout(),
    provenance: {},
    autoEnchant: true,
    inventory: [
      {
        instanceId: "equipped",
        itemId: 48499,
        enchantId: 3604,
        gemIds: [],
        source: "equipped",
        equippedSlot: "hands",
      },
      {
        instanceId: "bag",
        itemId: 47492,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      },
      {
        instanceId: "ring",
        itemId: 40370,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      },
    ],
  };
  s.settings.player!.profession1 = Profession.Engineering;
  s.settings.player!.profession2 = Profession.Jewelcrafting;
  s.professionLevels = { [Profession.Engineering]: 408 };
  s.equipped.hands = "equipped";
  return s;
}
it("copies equipped engineering enchants to empty candidates and passes them to the simulator", () => {
  const s = fixture(),
    loadout = { ...s.equipped, hands: "bag" };
  const overrides = prepareEnchants(s, loadout).overrides;
  expect(overrides).toEqual({ bag: 3604 });
  expect(
    simulationInput(s, loadout, 20, "1001").raid!.parties[0].players[0]
      .equipment!.items[6].enchant,
  ).toBe(3604);
  expect(validateLoadout(withEnhancements(s, {}, overrides), loadout)).toEqual(
    [],
  );
  expect(s.inventory[1].enchantId).toBe(0);
  expect(prepareEnchants(s, s.equipped).overrides).toEqual({});
});
it("preserves existing enchants and supports disabling automatic enchants", () => {
  const s = fixture(),
    loadout = { ...s.equipped, hands: "bag" };
  const enabledKey = loadoutKey(s, loadout);
  s.autoEnchant = false;
  expect(prepareEnchants(s, loadout).overrides).toEqual({});
  expect(loadoutKey(s, loadout)).not.toBe(enabledKey);
  s.autoEnchant = true;
  s.inventory[1].enchantId = 3860;
  expect(prepareEnchants(s, loadout).overrides).toEqual({});
});
it("adds ring enchants only for qualified enchanters, including retained rings in candidate sets", () => {
  const s = fixture(),
    loadout = { ...s.equipped, hands: "bag", finger1: "ring" };
  expect(prepareEnchants(s, loadout).overrides.ring).toBeUndefined();
  s.settings.player!.profession2 = Profession.Enchanting;
  s.professionLevels![Profession.Enchanting] = 400;
  expect(prepareEnchants(s, loadout).overrides.ring).toBe(3839);
  s.professionLevels![Profession.Enchanting] = 399;
  expect(prepareEnchants(s, loadout).overrides.ring).toBeUndefined();
});
it("does not copy profession enchants without that profession", () => {
  const s = fixture(),
    loadout = { ...s.equipped, hands: "bag" };
  s.settings.player!.profession1 = Profession.Mining;
  expect(prepareEnchants(s, loadout).overrides.bag).toBeUndefined();
});
it("retains weapon-specific runeforges without copying incompatible weapon enchants", () => {
  const s = fixture();
  s.inventory.push(
    {
      instanceId: "main",
      itemId: 47475,
      enchantId: 3370,
      gemIds: [],
      source: "equipped",
      equippedSlot: "mainHand",
    },
    {
      instanceId: "off",
      itemId: 47528,
      enchantId: 3368,
      gemIds: [],
      source: "equipped",
      equippedSlot: "offHand",
    },
    {
      instanceId: "new-main",
      itemId: 47475,
      enchantId: 0,
      gemIds: [],
      source: "bag",
    },
    {
      instanceId: "new-off",
      itemId: 47528,
      enchantId: 0,
      gemIds: [],
      source: "bag",
    },
  );
  s.equipped.mainHand = "main";
  s.equipped.offHand = "off";
  const loadout = { ...s.equipped, mainHand: "new-main", offHand: "new-off" };
  expect(prepareEnchants(s, loadout).overrides).toEqual({
    "new-main": 3370,
    "new-off": 3368,
  });
});

it("checks staff-only enchants before copying them onto one-handed weapons", () => {
  const s = fixture(),
    catalog = getCatalog();
  const staffEnchant = [...catalog.enchants.values()]
    .flat()
    .find((e) => e.effectId === 3854)!;
  expect(staffEnchant).toBeDefined();
  expect(enchantApplies(staffEnchant, catalog.items.get(47475)!, s)).toBe(
    false,
  );
});

it("uses spellpower ring enchants for casters and keeps accessory order equivalent", () => {
  const s = fixture();
  const spec = listSpecs().find((spec) => spec.module === "mage")!;
  s.specId = spec.id;
  s.settings = defaultSettings(spec.id);
  s.settings.player!.profession1 = Profession.Enchanting;
  const a = { ...s.equipped, hands: "bag", finger1: "ring" };
  const b = { ...a, finger1: null, finger2: "ring" };
  expect(prepareEnchants(s, a).overrides.ring).toBe(3840);
  expect(prepareEnchants(s, a).overrides).toEqual(
    prepareEnchants(s, b).overrides,
  );
});

it("stacks buckle and qualified blacksmith sockets with regular enchants", () => {
  const s = fixture(),
    catalog = getCatalog();
  s.settings.player!.profession2 = Profession.Blacksmithing;
  s.professionLevels![Profession.Blacksmithing] = 399;
  const glove = catalog.items.get(47492)!;
  expect(itemSockets(s, glove)).toEqual(glove.gemSockets);
  s.professionLevels![Profession.Blacksmithing] = 400;
  expect(itemSockets(s, glove)).toEqual([
    ...glove.gemSockets,
    GemColor.GemColorPrismatic,
  ]);
  expect(extraSocketLabel(glove, glove.gemSockets.length + 1)).toBe(
    "Blacksmith socket",
  );
  const belt = catalog.items.get(51000)!;
  expect(itemSockets(s, belt)).toEqual([
    ...belt.gemSockets,
    GemColor.GemColorPrismatic,
  ]);
  expect(extraSocketLabel(belt, belt.gemSockets.length + 1)).toBe(
    "Eternal Belt Buckle",
  );
  expect(
    prepareEnchants(s, { ...s.equipped, hands: "bag" }).overrides.bag,
  ).toBe(3604);
});

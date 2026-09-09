import { it, expect } from "vitest";
import {
  enumerateLoadouts,
  estimateAllowance,
  planRun,
  loadoutKey,
} from "./enumerate";
import { UIItem } from "@/generated/wotlk/ui";
import {
  ItemType,
  Class,
  HandType,
  WeaponType,
} from "@/generated/wotlk/common";
import { emptyLoadout } from "@/domain/top-gear/slots";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import type { Snapshot, Selection, WorkPolicy } from "@/domain/top-gear/model";
import { createCatalog } from "./catalog";
const policy: WorkPolicy = {
  version: "test",
  unitsPerSet: 5000,
  maxUnits: 300000,
  iterationsPerSet: 100,
  maxSearchNodes: 10000,
  maxJobSeconds: 60,
  maxAttempts: 2,
};
function fixture(types: ItemType[]) {
  const spec = listSpecs().find((s) => s.name === "Fury")!;
  const snapshot: Snapshot = {
    id: "fixture",
    specId: spec.id,
    versions: {
      engine: "test",
      schema: "test",
      catalog: "test",
      optimizer: "test",
      presets: "test",
    },
    settings: defaultSettings(spec.id),
    inventory: types.map((_, i) => ({
      instanceId: `i${i}`,
      itemId: 100 + i,
      enchantId: 0,
      gemIds: [],
      source: i === 0 ? "equipped" : "bag",
    })),
    equipped: emptyLoadout(),
    provenance: {},
  };
  const catalog = createCatalog({
    items: types.map((type, i) =>
      UIItem.create({
        id: 100 + i,
        name: `Item ${i}`,
        type,
        classAllowlist: [Class.ClassWarrior],
      }),
    ),
    gems: [],
    enchants: [],
  });
  const selection: Selection = {
    selectedInstanceIds: snapshot.inventory.map((i) => i.instanceId),
    lockedSlots: {},
    acknowledgedExclusions: [],
  };
  return { snapshot, selection, catalog };
}
it("enumerates all four interacting head/chest combinations", () => {
  const f = fixture([
    ItemType.ItemTypeHead,
    ItemType.ItemTypeHead,
    ItemType.ItemTypeChest,
    ItemType.ItemTypeChest,
  ]);
  f.snapshot.equipped.head = "i0";
  f.snapshot.equipped.chest = "i2";
  const result = [...enumerateLoadouts(f.snapshot, f.selection, f.catalog)];
  expect(result.map((r) => [r.head, r.chest])).toEqual([
    ["i0", "i2"],
    ["i0", "i3"],
    ["i1", "i2"],
    ["i1", "i3"],
  ]);
});
it("counts a ring pair once without duplicating a physical ring", () => {
  const f = fixture([ItemType.ItemTypeFinger, ItemType.ItemTypeFinger]);
  f.snapshot.equipped.finger1 = "i0";
  f.snapshot.equipped.finger2 = "i1";
  const result = [...enumerateLoadouts(f.snapshot, f.selection, f.catalog)];
  expect(result.map((r) => [r.finger1, r.finger2])).toEqual([["i0", "i1"]]);
  f.selection.selectedInstanceIds = ["i0"];
  expect([
    ...enumerateLoadouts(f.snapshot, f.selection, f.catalog),
  ]).toHaveLength(0);
});
it.each([ItemType.ItemTypeFinger, ItemType.ItemTypeTrinket])(
  "simulates an equipped pair once and preserves its exact baseline placement (%s)",
  (type) => {
    const f = fixture([type, type]);
    const [a, b] =
      type === ItemType.ItemTypeFinger
        ? (["finger1", "finger2"] as const)
        : (["trinket1", "trinket2"] as const);
    f.snapshot.equipped[a] = "i1";
    f.snapshot.equipped[b] = "i0";
    expect(
      estimateAllowance(f.snapshot, f.selection, policy, f.catalog).count,
    ).toBe(1);
    const plan = planRun(f.snapshot, f.selection, policy, f.catalog);
    expect(plan.candidateLoadouts).toHaveLength(1);
    expect(plan.simulations).toHaveLength(1);
    expect(plan.simulations[0].loadout).toEqual(f.snapshot.equipped);
  },
);
it("keeps enhancements attached, counts three ring pairs, and honors a slot lock", () => {
  const f = fixture(Array(3).fill(ItemType.ItemTypeFinger));
  f.snapshot.equipped.finger1 = "i0";
  f.snapshot.equipped.finger2 = "i1";
  f.snapshot.inventory[2].itemId = f.snapshot.inventory[0].itemId;
  f.snapshot.inventory[2].enchantId = 123;
  f.catalog.enchants.set(123, []);
  // Key identity must distinguish an enhanced copy from the plain copy.
  expect(
    loadoutKey(f.snapshot, { ...f.snapshot.equipped, finger1: "i2" }),
  ).not.toBe(loadoutKey(f.snapshot, f.snapshot.equipped));
  f.snapshot.inventory[2].enchantId = 0;
  f.snapshot.inventory[2].itemId = 102;
  expect(
    planRun(f.snapshot, f.selection, policy, f.catalog).simulations,
  ).toHaveLength(3);
  f.selection.lockedSlots.finger1 = "i1";
  const locked = planRun(f.snapshot, f.selection, policy, f.catalog);
  expect(locked.candidateLoadouts).toHaveLength(2);
  expect(locked.candidateLoadouts.every((l) => l.finger1 === "i1")).toBe(true);
  expect(locked.simulations).toHaveLength(2);
  expect(locked.allowance.count).toBe(2);
  expect(
    estimateAllowance(f.snapshot, f.selection, policy, f.catalog).count,
  ).toBe(2);
});
it("preserves main-hand/off-hand distinctions", () => {
  const f = fixture([ItemType.ItemTypeWeapon, ItemType.ItemTypeWeapon]);
  expect(
    loadoutKey(f.snapshot, {
      ...emptyLoadout(),
      mainHand: "i0",
      offHand: "i1",
    }),
  ).not.toBe(
    loadoutKey(f.snapshot, {
      ...emptyLoadout(),
      mainHand: "i1",
      offHand: "i0",
    }),
  );
});
it("enforces unique copies and locks without discarding the reference", () => {
  const f = fixture([ItemType.ItemTypeHead, ItemType.ItemTypeHead]);
  f.snapshot.equipped.head = "i0";
  f.selection.lockedSlots.head = "i1";
  const plan = planRun(f.snapshot, f.selection, policy, f.catalog);
  expect(plan.candidateLoadouts).toHaveLength(1);
  expect(plan.candidateLoadouts[0].head).toBe("i1");
  expect(plan.simulations).toHaveLength(2);
});
it("charges equipped exactly once and refuses 61 complete work units", () => {
  const f = fixture(Array(60).fill(ItemType.ItemTypeHead));
  f.snapshot.equipped.head = "i0";
  expect(
    estimateAllowance(f.snapshot, f.selection, policy, f.catalog).allowed,
  ).toBe(true);
  const last = UIItem.create({
    id: 999,
    name: "extra",
    type: ItemType.ItemTypeHead,
  });
  f.catalog.items.set(999, last);
  f.snapshot.inventory.push({
    instanceId: "extra",
    itemId: 999,
    enchantId: 0,
    gemIds: [],
    source: "bag",
  });
  f.selection.selectedInstanceIds.push("extra");
  expect(
    estimateAllowance(f.snapshot, f.selection, policy, f.catalog).allowed,
  ).toBe(false);
});
it("rejects two handed offhand without the talent", () => {
  const f = fixture([ItemType.ItemTypeWeapon, ItemType.ItemTypeWeapon]);
  f.snapshot.settings.player!.talentsString = "";
  for (const item of f.catalog.items.values()) {
    item.handType = HandType.HandTypeTwoHand;
    item.weaponType = WeaponType.WeaponTypeSword;
  }
  f.snapshot.equipped.mainHand = "i0";
  f.snapshot.equipped.offHand = "i1";
  f.selection.lockedSlots.mainHand = "i0";
  f.selection.lockedSlots.offHand = "i1";
  expect([
    ...enumerateLoadouts(f.snapshot, f.selection, f.catalog),
  ]).toHaveLength(0);
});

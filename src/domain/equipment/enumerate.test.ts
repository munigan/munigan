import { it, expect } from "vitest";
import { enumerateLoadouts, estimateAllowance, planRun } from "./enumerate";
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
it("never duplicates a physical ring and preserves slot order", () => {
  const f = fixture([ItemType.ItemTypeFinger, ItemType.ItemTypeFinger]);
  f.snapshot.equipped.finger1 = "i0";
  f.snapshot.equipped.finger2 = "i1";
  const result = [...enumerateLoadouts(f.snapshot, f.selection, f.catalog)];
  expect(result.map((r) => [r.finger1, r.finger2])).toEqual([
    ["i0", "i1"],
    ["i1", "i0"],
  ]);
  f.selection.selectedInstanceIds = ["i0"];
  expect([
    ...enumerateLoadouts(f.snapshot, f.selection, f.catalog),
  ]).toHaveLength(0);
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

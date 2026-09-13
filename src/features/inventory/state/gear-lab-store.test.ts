import { expect, it, vi } from "vitest";
import { itemVersions } from "@/domain/top-gear/item-version";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import { createGearLabStore } from "./gear-lab-store";

it("changes precision without replacing gear or another session", () => {
  const a = createGearLabStore(purchaseFixture({ frost: 100 }));
  const b = createGearLabStore(purchaseFixture({ frost: 100 }));
  const before = a.getState().draft!;
  a.getState().actions.setIterations(4000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(a.getState().draft!.snapshot).toBe(before.snapshot);
  expect(a.getState().draft!.selection).toBe(before.selection);
  expect(a.getState().draft!.purchases).toBe(before.purchases);
  expect(a.getState().draft!.iterations).toBe(4000);
  expect(b.getState().draft!.iterations).toBeUndefined();
});

it("rejects unavailable, out-of-range, and off-step precision edits", () => {
  const store = createGearLabStore(purchaseFixture());
  const initial = store.getState();

  store.getState().actions.setIterations(1000, purchasePolicy);
  store.getState().actions.setIterations(6500, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  store.getState().actions.setIterations(750, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });

  expect(store.getState()).toBe(initial);
});

it("keeps state identity for an unchanged precision edit", () => {
  const draft = { ...purchaseFixture(), iterations: 1000 };
  const store = createGearLabStore(draft);
  const initial = store.getState();

  store.getState().actions.setIterations(1000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });

  expect(store.getState()).toBe(initial);
});

it("normalizes replacement drafts and increments the epoch", () => {
  const store = createGearLabStore();
  const draft = purchaseFixture();
  draft.snapshot.gemming = undefined;
  draft.snapshot.autoEnchant = undefined;
  draft.snapshot.inventory.push({
    instanceId: "unsupported-bag-item",
    itemId: 999999,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  draft.selection.selectedInstanceIds.push("unsupported-bag-item");
  draft.selection.lockedSlots = { head: "unsupported-bag-item" };

  store.getState().actions.replaceDraft(draft);

  const state = store.getState();
  expect(state.epoch).toBe(1);
  expect(state.draft?.snapshot.gemming).toBeDefined();
  expect(state.draft?.snapshot.autoEnchant).toBe(true);
  expect(state.draft?.selection.selectedInstanceIds).toEqual(["owned-legs"]);
  expect(state.draft?.selection.acknowledgedExclusions).toEqual([
    "unsupported-bag-item",
  ]);
  expect(state.draft?.selection.lockedSlots).toEqual({});

  state.actions.replaceDraft(null);
  expect(store.getState().draft).toBeNull();
  expect(store.getState().epoch).toBe(2);
});

it("keeps a second physical copy when toggling the first", () => {
  const request = purchaseFixture();
  request.snapshot.inventory.push({
    ...request.snapshot.inventory[0],
    instanceId: "bag-legs",
    source: "bag",
    equippedSlot: undefined,
  });
  request.selection.selectedInstanceIds.push("bag-legs");
  const store = createGearLabStore(request);
  const snapshot = store.getState().draft!.snapshot;

  store.getState().actions.toggleItem("owned-legs");

  expect(store.getState().draft!.selection.selectedInstanceIds).toEqual([
    "bag-legs",
  ]);
  expect(store.getState().draft!.snapshot).toBe(snapshot);
});

it("does not select an unknown or unsupported item instance", () => {
  const request = purchaseFixture();
  request.snapshot.inventory.push({
    instanceId: "unsupported",
    itemId: 999999,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  const store = createGearLabStore(request);
  const initial = store.getState();

  store.getState().actions.toggleItem("unsupported");
  store.getState().actions.toggleItem("missing");

  expect(store.getState()).toBe(initial);
});

it("maps purchase inclusion without replacing the snapshot or selection", () => {
  const store = createGearLabStore(purchaseFixture());
  const before = store.getState().draft!;

  store.getState().actions.setPurchaseIncluded(48505, false);

  expect(store.getState().draft!.snapshot).toBe(before.snapshot);
  expect(store.getState().draft!.selection).toBe(before.selection);
  expect(store.getState().draft!.purchases!.excludedItemIds.original).toEqual([
    48505,
  ]);
});

it("rejects invalid resource quantities without publishing partial state", () => {
  const store = createGearLabStore(purchaseFixture({ frost: 10 }));
  const initial = store.getState();

  expect(() =>
    store.getState().actions.setResourceQuantity("frost", 1.5),
  ).toThrow(/Invalid purchase resource quantity/);
  expect(store.getState()).toBe(initial);
});

it("saves resource replacement and variant in one notification", () => {
  const store = createGearLabStore(purchaseFixture({ frost: 10 }));
  const listener = vi.fn();
  store.subscribe(listener);

  store.getState().actions.saveResource({
    previousId: "frost",
    id: "triumph",
    quantity: 25,
    gearVariant: "dk-dps",
  });

  expect(store.getState().draft!.purchases).toMatchObject({
    balances: { triumph: 25 },
    gearVariant: "dk-dps",
  });
  expect(listener).toHaveBeenCalledTimes(1);
});

it("preserves purchase choices when replacing the sole resource", () => {
  const request = purchaseFixture({ frost: 10 });
  request.purchases!.excludedItemIds.original = [48505];
  request.purchases!.itemEnhancements.original = {
    "48505": { enchantId: 0 },
  };
  const store = createGearLabStore(request);

  store.getState().actions.saveResource({
    previousId: "frost",
    id: "triumph",
    quantity: 25,
    gearVariant: "dk-dps",
  });

  expect(store.getState().draft!.purchases).toMatchObject({
    balances: { triumph: 25 },
    excludedItemIds: { original: [48505] },
    itemEnhancements: { original: { "48505": { enchantId: 0 } } },
  });
});

it("rejects a gear variant for another class atomically", () => {
  const store = createGearLabStore(purchaseFixture({ frost: 10 }));
  const initial = store.getState();

  expect(() =>
    store.getState().actions.saveResource({
      id: "triumph",
      quantity: 25,
      gearVariant: "mage-dps",
    }),
  ).toThrow(/variant/i);
  expect(store.getState()).toBe(initial);
});

it("merges profile fields into the latest snapshot and revalidates bags", () => {
  const request = purchaseFixture();
  const staged = {
    specId: request.snapshot.specId,
    settings: request.snapshot.settings,
    provenance: { profile: "preset" as const },
    professionLevels: { 14: 450 },
  };
  const store = createGearLabStore(request);
  store.getState().actions.addCustomItems("head", [50712]);

  store.getState().actions.applySettings(staged);

  expect(
    store
      .getState()
      .draft!.snapshot.inventory.some(
        (item) => item.instanceId === "custom-50712",
      ),
  ).toBe(true);
  expect(store.getState().draft!.snapshot.provenance).toEqual({
    profile: "preset",
  });
});

it("removes custom item selection, locks, exclusions, and enhancements", () => {
  const request = purchaseFixture();
  const store = createGearLabStore(request);
  store.getState().actions.addCustomItems("head", [50712]);
  store.getState().actions.setItemEnhancements("custom-50712", {
    enchantId: 0,
  });
  const edited = store.getState().draft!;
  edited.selection.lockedSlots.head = "custom-50712";
  edited.selection.acknowledgedExclusions.push("custom-50712");

  store.getState().actions.removeCustomItem("custom-50712");

  expect(store.getState().draft!.snapshot.inventory).toHaveLength(1);
  expect(store.getState().draft!.snapshot.itemEnhancements).toBeUndefined();
  expect(store.getState().draft!.selection.selectedInstanceIds).toEqual([
    "owned-legs",
  ]);
  expect(store.getState().draft!.selection.lockedSlots).toEqual({});
  expect(store.getState().draft!.selection.acknowledgedExclusions).toEqual([]);
});

it("updates item version metadata and revalidates purchase choices", () => {
  const request = purchaseFixture();
  request.purchases!.excludedItemIds.original = [48505];
  const store = createGearLabStore(request);

  store.getState().actions.setItemVersion("classic");

  expect(store.getState().draft!.snapshot.itemVersion).toBe("classic");
  expect(store.getState().draft!.snapshot.itemDataRevision).toBe(
    itemVersions.classic.revision,
  );
  expect(store.getState().draft!.snapshot.provenance.itemVersion).toBe(
    "edited",
  );
});

it("defers catalog repair on profile edits so its removed IDs remain visible", () => {
  const request = purchaseFixture();
  request.purchases!.recipeRevision = "retired-revision";
  request.purchases!.excludedItemIds.original = [9_999_998];
  request.purchases!.itemEnhancements.original = {
    "9999999": { gemIds: [null] },
  };
  const store = createGearLabStore(request);

  store.getState().actions.setItemVersion("classic");

  expect(store.getState().draft!.purchases!.excludedItemIds.original).toEqual([
    9_999_998,
  ]);
  expect(store.getState().draft!.purchases!.itemEnhancements.original).toEqual({
    "9999999": { gemIds: [null] },
  });
  expect(store.getState().draft!.purchases!.recipeRevision).toBe(
    "retired-revision",
  );
  expect(store.getState().actions.revalidatePurchases()).toEqual([
    9_999_998, 9_999_999,
  ]);
});

it("defers catalog repair when applying settings", () => {
  const request = purchaseFixture();
  request.purchases!.recipeRevision = "retired-revision";
  request.purchases!.excludedItemIds.original = [9_999_998];
  const store = createGearLabStore(request);

  store.getState().actions.applySettings({
    specId: request.snapshot.specId,
    settings: request.snapshot.settings,
    provenance: { profile: "edited" },
    professionLevels: { 14: 450 },
  });

  expect(store.getState().draft!.purchases!.recipeRevision).toBe(
    "retired-revision",
  );
  expect(store.getState().actions.revalidatePurchases()).toEqual([9_999_998]);
});

it("does not notify subscribers for equal edits", () => {
  const request = purchaseFixture({ frost: 10 });
  request.purchases!.gearVariant = "dk-dps";
  request.snapshot.autoEnchant = true;
  const store = createGearLabStore(request);
  const listener = vi.fn();
  store.subscribe(listener);

  store.getState().actions.setResourceQuantity("frost", 10);
  store.getState().actions.setGearVariant("dk-dps");
  store.getState().actions.setAutoEnchant(true);
  store.getState().actions.setItemVersion("original");
  store.getState().actions.setItemEnhancements("owned-legs", {});

  expect(listener).not.toHaveBeenCalled();
});

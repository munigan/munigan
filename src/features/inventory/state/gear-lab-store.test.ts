import { expect, it } from "vitest";
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

import { expect, it } from "vitest";
import { Profession } from "@/generated/wotlk/common";
import { preparePurchases } from "@/domain/purchases/candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { previewItemEnhancements } from "@/domain/equipment/item-enhancements";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { canEquip, validateItem } from "@/domain/equipment/validate";
import { getCatalog } from "@/domain/equipment/catalog";
import { slotGroup } from "@/domain/equipment/custom-items";
import { orderPurchaseVariants } from "../purchases/presentation";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import { createGearLabStore } from "./gear-lab-store";
import {
  createAnalysisInputSelector,
  createInventorySelector,
  createNonPurchaseSelector,
  createRowPresentationSelector,
  createWalletRequestSelector,
} from "./gear-lab-selectors";

function fixture() {
  const request = purchaseFixture({ frost: 100, triumph: 100 });
  request.snapshot.inventory.push({
    ...request.snapshot.inventory[0],
    instanceId: "bag-legs",
    source: "bag",
    equippedSlot: undefined,
  });
  return request;
}
function prepared(request = fixture()) {
  return preparePurchases(request, createSearchBudget(null));
}

it("reuses the analysis input when only precision and slider range change", () => {
  const store = createGearLabStore(fixture());
  const select = createAnalysisInputSelector();
  const first = select(store.getState(), purchasePolicy)!;
  store.getState().actions.setIterations(4000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(
    select(store.getState(), {
      ...purchasePolicy,
      iterationsPerSet: 4000,
      selectableIterations: { min: 500, max: 6000, step: 500 },
    }),
  ).toBe(first);
  expect(first.request).not.toHaveProperty("iterations");
  expect(first.policy).toEqual({ ...purchasePolicy, iterationsPerSet: 1 });
});

it("invalidates analysis inputs for legality policy fields and session replacement", () => {
  const store = createGearLabStore(fixture());
  const select = createAnalysisInputSelector();
  const first = select(store.getState(), purchasePolicy);
  for (const changed of [
    { version: "new" },
    { unitsPerSet: 2 },
    { maxUnits: null },
    { maxSearchNodes: 3 },
    { maxJobSeconds: 4 },
    { maxAttempts: 2 },
  ]) {
    expect(
      select(store.getState(), { ...purchasePolicy, ...changed }),
    ).not.toBe(first);
    expect(select(store.getState(), purchasePolicy)?.policy).toEqual(
      first?.policy,
    );
  }
  store.getState().actions.replaceDraft(store.getState().draft);
  expect(select(store.getState(), purchasePolicy)).not.toBe(first);
  expect(select(store.getState(), null)).toBeNull();
});

it("preserves unedited rows, previews and group ID arrays across checkbox edits", () => {
  const store = createGearLabStore(fixture());
  const select = createInventorySelector();
  const first = select(store.getState().draft!, null);
  store.getState().actions.toggleItem("bag-legs");
  const next = select(store.getState().draft!, null);
  expect(next.byId.get("owned-legs")).toBe(first.byId.get("owned-legs"));
  expect(next.byId.get("bag-legs")?.selected).toBe(true);
  expect(next.byId.get("bag-legs")?.preview).toBe(
    first.byId.get("bag-legs")?.preview,
  );
  expect(next.groups).toBe(first.groups);
  expect(next.groups.get("legs")).toEqual(["owned-legs", "bag-legs"]);
  expect(select(store.getState().draft!, null)).toBe(next);
});

it("keeps another row stable when an unequipped item's override changes", () => {
  const store = createGearLabStore(fixture());
  const select = createInventorySelector();
  const first = select(store.getState().draft!, null);
  store.getState().actions.setItemEnhancements("bag-legs", { enchantId: 0 });
  const next = select(store.getState().draft!, null);
  expect(next.byId.get("owned-legs")).toBe(first.byId.get("owned-legs"));
  expect(next.byId.get("bag-legs")?.preview.enchantId).toBe(0);
});

it("refreshes previews on global settings and validates a changed profile", () => {
  const request = fixture();
  request.snapshot.inventory[0].enchantId = 3823;
  const store = createGearLabStore(request);
  const select = createInventorySelector();
  const first = select(store.getState().draft!, null);
  expect(first.byId.get("bag-legs")?.preview.enchantId).toBe(3823);
  store.getState().actions.setAutoEnchant(false);
  expect(
    select(store.getState().draft!, null).byId.get("bag-legs")?.preview
      .enchantId,
  ).toBe(0);
  const draft = store.getState().draft!;
  const changed = {
    ...draft,
    snapshot: {
      ...draft.snapshot,
      settings: {
        ...draft.snapshot.settings,
        player: { ...draft.snapshot.settings.player!, class: 8 },
      },
    },
  };
  const next = select(changed, null);
  expect(next.unsupported.map((i) => i.instanceId)).toContain("bag-legs");
  expect(next.groups.get("legs")).toEqual([]);
});

it("reconciles equivalent decoded worker replies by stable item values", () => {
  const request = fixture();
  const preview = prepared(request);
  const select = createInventorySelector();
  const first = select(request, preview);
  const next = select(request, structuredClone(preview));
  expect(next).toBe(first);
  for (const [id, row] of first.byId) expect(next.byId.get(id)).toBe(row);
});

it("overlays current owned selection and exclusions while purchase analysis is pending", () => {
  const store = createGearLabStore(fixture());
  const preview = prepared(store.getState().draft!);
  const candidate = preview.candidates.find((c) => c.available)!;
  const select = createInventorySelector();
  const first = select(store.getState().draft!, preview);
  store.getState().actions.toggleItem("bag-legs");
  store
    .getState()
    .actions.setPurchaseIncluded(candidate.instance.itemId, false);
  const next = select(store.getState().draft!, preview);
  expect(next.byId.get("bag-legs")?.selected).toBe(true);
  expect(next.byId.get(candidate.instance.instanceId)?.selected).toBe(false);
  expect(next.groups).toBe(first.groups);
  expect(next.selectedCount).toBe(first.selectedCount);
});

it("never revives a converted custom selection and retains unavailable custom rewards", () => {
  const store = createGearLabStore(purchaseFixture());
  store.getState().actions.addCustomItems("head", [48503]);
  const request = store.getState().draft!;
  const preview = prepared(request);
  const select = createInventorySelector();
  const before = select(request, null);
  expect(before.byId.get("custom-48503")?.disabled).toBe(true);
  const next = select(request, preview);
  expect(next.selection.selectedInstanceIds).not.toContain("custom-48503");
  expect([...next.groups.values()].flat()).not.toContain("custom-48503");
  const reward = [...next.byId.values()].find(
    (r) => r.item.source === "purchase" && r.item.itemId === 48503,
  )!;
  expect(reward).toMatchObject({
    unavailable: true,
    selected: false,
    removable: true,
    usesResources: true,
  });
});

it("preserves physical duplicates, generated deduplication and variant ordering", () => {
  const request = fixture();
  const preview = prepared(request);
  const view = createInventorySelector()(request, preview);
  const catalog = getCatalog(request.snapshot.itemVersion);
  const purchases = getPurchaseCatalog("original");
  for (const [slot, ids] of view.groups) {
    const valid = preview.snapshot.inventory.filter(
      (i) =>
        !validateItem(preview.snapshot, i).length &&
        (i.source !== "purchase" ||
          preview.candidates.find((c) => c.instance.instanceId === i.instanceId)
            ?.available),
    );
    const expected = orderPurchaseVariants(
      valid.filter((i) =>
        slotGroup(slot).some((s) =>
          canEquip(preview.snapshot, catalog.items.get(i.itemId)!, s),
        ),
      ),
      (i) =>
        i.source === "purchase" ? purchases.byItemId.get(i.itemId) : undefined,
      request.snapshot.specId,
      request.snapshot.settings.player!.class,
    );
    expect(ids).toEqual(expected.map((i) => i.instanceId));
  }
  expect(
    view.groups
      .get("legs")
      ?.filter((id) => id === "owned-legs" || id === "bag-legs"),
  ).toEqual(["owned-legs", "bag-legs"]);
  expect(
    [...view.byId.values()].filter(
      (r) => r.item.source === "purchase" && r.item.itemId === 48504,
    ),
  ).toHaveLength(0);
});

it("caches nonpurchase allowance and enhancement enumeration independently of precision", () => {
  const request = fixture();
  delete request.purchases;
  const store = createGearLabStore(request);
  const select = createNonPurchaseSelector();
  const first = select(store.getState(), purchasePolicy)!;
  expect(first.enhancementAnalysis).toBeNull();
  store.getState().actions.setIterations(4000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(
    select(store.getState(), { ...purchasePolicy, iterationsPerSet: 4000 }),
  ).toBe(first);
  store.getState().actions.setItemEnhancements("owned-legs", { enchantId: 0 });
  expect(
    select(store.getState(), purchasePolicy)?.enhancementAnalysis,
  ).not.toBeNull();
  expect(select(store.getState(), null)).toBeNull();
  expect(
    select(createGearLabStore(fixture()).getState(), purchasePolicy),
  ).toBeNull();
});

it("recomputes another row when equipped overrides change the shared JC allocation", () => {
  const request = fixture();
  request.snapshot.settings.player!.profession1 = Profession.Jewelcrafting;
  request.snapshot.professionLevels = { [Profession.Jewelcrafting]: 450 };
  request.snapshot.inventory.push({
    instanceId: "bag-chest",
    itemId: 48501,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  const store = createGearLabStore(request);
  const select = createInventorySelector();
  const first = select(store.getState().draft!, null);
  const before = first.byId.get("bag-chest")!.preview;
  const jcGemId = store.getState().draft!.snapshot.gemming!.jcGemId;
  expect(before.gemIds.filter((id) => id === jcGemId)).toHaveLength(2);

  store
    .getState()
    .actions.setItemEnhancements("owned-legs", { gemIds: [jcGemId, jcGemId] });

  const next = select(store.getState().draft!, null);
  const after = next.byId.get("bag-chest")!.preview;
  expect(after.gemIds.filter((id) => id === jcGemId)).toHaveLength(1);
  expect(after).toEqual(
    previewItemEnhancements(
      store.getState().draft!.snapshot,
      request.snapshot.inventory.at(-1)!,
    ),
  );
  expect(after).not.toBe(before);
  expect(next.groups).toBe(first.groups);
});

it("uses the latest purchase override before a newer worker result arrives", () => {
  const store = createGearLabStore(fixture());
  const preview = prepared(store.getState().draft!);
  const candidate = preview.candidates.find(
    (c) => c.available && c.instance.itemId === 48501,
  )!;
  const select = createInventorySelector();
  select(store.getState().draft!, preview);
  store.getState().actions.setPurchaseEnhancements(candidate.instance.itemId, {
    gemIds: [0, 0],
  });
  const next = select(store.getState().draft!, preview);
  expect(next.byId.get(candidate.instance.instanceId)?.preview.gemIds).toEqual([
    0, 0,
  ]);
});

it("does not rebuild candidate membership for precision-only edits", () => {
  const store = createGearLabStore(fixture());
  const preview = prepared(store.getState().draft!);
  const candidates = preview.candidates;
  let reads = 0;
  Object.defineProperty(preview, "candidates", {
    get: () => {
      reads++;
      return candidates;
    },
  });
  const select = createInventorySelector();
  const first = select(store.getState().draft!, preview);
  const before = reads;
  store.getState().actions.setIterations(4000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(select(store.getState().draft!, preview)).toBe(first);
  expect(reads).toBe(before);
});

it("keeps wallet projections stable across precision while preserving row manual badges", () => {
  const store = createGearLabStore(fixture());
  const wallet = createWalletRequestSelector();
  const inventory = createInventorySelector();
  const present = createRowPresentationSelector("bag-legs");
  const initial = store.getState();
  const walletRequest = wallet(initial);
  const rowSnapshot = present(inventory(initial.draft!, null));
  store.getState().actions.setIterations(500, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(wallet(store.getState())).toBe(walletRequest);
  store.getState().actions.setPurchaseIncluded(50098, false);
  expect(wallet(store.getState())).toBe(walletRequest);
  store.getState().actions.setItemEnhancements("owned-legs", { enchantId: 0 });
  expect(present(inventory(store.getState().draft!, null))).toBe(rowSnapshot);
  store.getState().actions.setItemEnhancements("bag-legs", { enchantId: 0 });
  const next = present(inventory(store.getState().draft!, null));
  expect(next).not.toBe(rowSnapshot);
  expect(next.itemEnhancements?.["bag-legs"]).toEqual({ enchantId: 0 });
});

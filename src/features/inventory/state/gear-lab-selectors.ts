import { getCatalog } from "@/domain/equipment/catalog";
import { slotGroup } from "@/domain/equipment/custom-items";
import {
  analyzeItemEnhancementSets,
  estimateAllowance,
} from "@/domain/equipment/enumerate";
import { previewItemEnhancements } from "@/domain/equipment/item-enhancements";
import { canEquip, validateItem } from "@/domain/equipment/validate";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { effectivePurchaseItem } from "@/domain/purchases/enhancements";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import type {
  Allowance,
  ItemEnhancementOverride,
  ItemInstance,
  Selection,
  Slot,
  Snapshot,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import { orderPurchaseVariants } from "../purchases/presentation";
import type { PurchasePreview } from "../purchases/purchase-worker-contract";
import type { GearLabState } from "./gear-lab-store";

export type AnalysisInput = {
  epoch: number;
  request: Omit<TopGearRequest, "iterations">;
  policy: WorkPolicy;
};

function sameArray<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function sameRecord<T>(
  a: Readonly<Record<string, T>>,
  b: Readonly<Record<string, T>>,
) {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => a[key] === b[key])
  );
}
function legalityPolicy(policy: WorkPolicy): WorkPolicy {
  return {
    version: policy.version,
    unitsPerSet: policy.unitsPerSet,
    maxUnits: policy.maxUnits,
    iterationsPerSet: 1,
    maxSearchNodes: policy.maxSearchNodes,
    maxJobSeconds: policy.maxJobSeconds,
    maxAttempts: policy.maxAttempts,
  };
}

export function createAnalysisInputSelector(): (
  state: GearLabState,
  policy: WorkPolicy | null,
) => AnalysisInput | null {
  let previous: AnalysisInput | null = null;
  return (state, policy) => {
    if (!state.draft || !policy) return (previous = null);
    const request = { ...state.draft };
    delete request.iterations;
    const normalized = legalityPolicy(policy);
    if (
      previous &&
      previous.epoch === state.epoch &&
      sameRecord(previous.request, request) &&
      sameRecord(previous.policy, normalized)
    )
      return previous;
    return (previous = { epoch: state.epoch, request, policy: normalized });
  };
}

export type InventoryRowView = {
  item: ItemInstance;
  preview: ItemInstance;
  selected: boolean;
  usesResources: boolean;
  unavailable: boolean;
  disabled: boolean;
  removable: boolean;
};
export type InventoryView = {
  byId: ReadonlyMap<string, InventoryRowView>;
  groups: ReadonlyMap<Slot, readonly string[]>;
  unsupported: readonly ItemInstance[];
  invalidCustom: readonly ItemInstance[];
  selectedCount: number;
  totalCount: number;
  snapshot: Snapshot;
  selection: Selection;
};

function sameItem(a: ItemInstance, b: ItemInstance) {
  return (
    a.instanceId === b.instanceId &&
    a.itemId === b.itemId &&
    a.source === b.source &&
    a.equippedSlot === b.equippedSlot &&
    a.enchantId === b.enchantId &&
    sameArray(a.gemIds, b.gemIds)
  );
}
function sameOverride(a: ItemEnhancementOverride, b: ItemEnhancementOverride) {
  return (
    a.enchantId === b.enchantId && sameArray(a.gemIds ?? [], b.gemIds ?? [])
  );
}
const groupSlots = slots.filter(
  (s) => s !== "finger2" && s !== "trinket2" && s !== "offHand",
);

/** Each mounted inventory owns its bounded, latest-projection caches. */
export function createInventorySelector(): (
  draft: TopGearRequest,
  preview: PurchasePreview | null,
) => InventoryView {
  let previous: InventoryView | undefined;
  let previousDraft: TopGearRequest | undefined;
  let previousPreview: PurchasePreview | null | undefined;
  let validationKey: readonly unknown[] = [];
  let validated = new Map<string, { item: ItemInstance; valid: boolean }>();
  let previewCache = new Map<
    string,
    { dependencies: readonly unknown[]; item: ItemInstance }
  >();
  let groupingKey: readonly unknown[] = [];
  let snapshotKey: readonly unknown[] = [];

  return (draft, suppliedPreview) => {
    // A former purchase preview must disappear immediately when its wallet is removed.
    const purchasePreview = draft.purchases ? suppliedPreview : null;
    if (
      previous &&
      previousDraft?.snapshot === draft.snapshot &&
      previousDraft.selection === draft.selection &&
      previousDraft.purchases === draft.purchases &&
      previousPreview === purchasePreview
    )
      return previous;
    const profile = itemVersionOf(draft.snapshot);
    const catalog = getCatalog(profile);
    const purchaseCatalog = draft.purchases
      ? getPurchaseCatalog(profile)
      : null;
    const customRewardIds = new Set(
      draft.snapshot.inventory
        .filter((i) => i.source === "custom")
        .map((i) => i.itemId),
    );
    const candidateById = new Map(
      purchasePreview?.candidates.map((c) => [c.instance.instanceId, c]),
    );
    const selectedCustomIds = draft.snapshot.inventory
      .filter(
        (i) =>
          i.source === "custom" &&
          draft.selection.selectedInstanceIds.includes(i.instanceId),
      )
      .map((i) => i.instanceId);
    const nextSnapshotKey = [
      draft.snapshot,
      draft.purchases?.itemEnhancements,
      purchasePreview?.snapshot.inventory,
      ...selectedCustomIds,
    ];
    let snapshot = previous?.snapshot;
    if (!snapshot || !sameArray(snapshotKey, nextSnapshotKey)) {
      const oldItems = new Map(
        previous?.snapshot.inventory.map((i) => [i.instanceId, i]),
      );
      const reconcileItem = (item: ItemInstance) => {
        const old = oldItems.get(item.instanceId);
        return old && sameItem(old, item) ? old : item;
      };
      const inventory = draft.snapshot.inventory.map(reconcileItem);
      const overrides = { ...draft.snapshot.itemEnhancements };
      // Worker decoding loses object identity. Reconcile only at this boundary, and
      // take editable intent from the current draft while candidate search catches up.
      if (purchasePreview) {
        for (const item of purchasePreview.snapshot.inventory) {
          if (item.source !== "purchase") continue;
          let effective = item;
          try {
            const result = effectivePurchaseItem(draft, item.itemId);
            // Do not mix generated IDs from a different item-data profile.
            if (result.instance.instanceId !== item.instanceId) continue;
            effective = result.instance;
            if (result.override) overrides[item.instanceId] = result.override;
          } catch {
            // Invalid imported intent remains visible and editable; admission reports it.
            const override =
              draft.purchases?.itemEnhancements[profile]?.[String(item.itemId)];
            if (override) overrides[item.instanceId] = override;
          }
          inventory.push(reconcileItem(effective));
        }
      }
      const oldOverrides = previous?.snapshot.itemEnhancements ?? {};
      for (const [id, override] of Object.entries(overrides)) {
        if (oldOverrides[id] && sameOverride(oldOverrides[id], override))
          overrides[id] = oldOverrides[id];
      }
      const reconciledOverrides = sameRecord(oldOverrides, overrides)
        ? previous?.snapshot.itemEnhancements
        : Object.keys(overrides).length
          ? overrides
          : undefined;
      const nextSnapshot: Snapshot = {
        ...draft.snapshot,
        inventory:
          previous && sameArray(previous.snapshot.inventory, inventory)
            ? previous.snapshot.inventory
            : inventory,
        itemEnhancements: reconciledOverrides,
      };
      snapshot =
        previous && sameRecord(previous.snapshot, nextSnapshot)
          ? previous.snapshot
          : nextSnapshot;
      snapshotKey = nextSnapshotKey;
    }
    const isConvertedCustom = (item: ItemInstance) =>
      item.source === "custom" && !!purchaseCatalog?.byItemId.has(item.itemId);
    const excluded = new Set(draft.purchases?.excludedItemIds[profile] ?? []);
    const currentSelected = new Set(draft.selection.selectedInstanceIds);
    const selectedIds = snapshot.inventory
      .filter((item) =>
        item.source === "purchase"
          ? !!candidateById.get(item.instanceId)?.available &&
            !excluded.has(item.itemId)
          : currentSelected.has(item.instanceId) &&
            !(purchasePreview && isConvertedCustom(item)),
      )
      .map((i) => i.instanceId);
    const lockedSlots = { ...draft.selection.lockedSlots };
    if (purchasePreview) {
      for (const [slot, id] of Object.entries(lockedSlots)) {
        const original = snapshot.inventory.find(
          (i) => i.instanceId === id && isConvertedCustom(i),
        );
        const replacement =
          original &&
          snapshot.inventory.find(
            (i) => i.source === "purchase" && i.itemId === original.itemId,
          );
        if (replacement) lockedSlots[slot as Slot] = replacement.instanceId;
      }
    }
    const nextSelection: Selection = {
      selectedInstanceIds:
        previous &&
        sameArray(previous.selection.selectedInstanceIds, selectedIds)
          ? previous.selection.selectedInstanceIds
          : selectedIds,
      acknowledgedExclusions:
        previous &&
        sameArray(
          previous.selection.acknowledgedExclusions,
          draft.selection.acknowledgedExclusions,
        )
          ? previous.selection.acknowledgedExclusions
          : draft.selection.acknowledgedExclusions,
      lockedSlots:
        previous && sameRecord(previous.selection.lockedSlots, lockedSlots)
          ? previous.selection.lockedSlots
          : lockedSlots,
    };
    const selection =
      previous && sameRecord(previous.selection, nextSelection)
        ? previous.selection
        : nextSelection;
    const selected = new Set(selection.selectedInstanceIds);

    // Validation depends on character eligibility and raw inventory, not checkbox
    // membership or enhancement overrides applied to candidate previews.
    const eligibility = [
      profile,
      snapshot.specId,
      snapshot.settings,
      snapshot.professionLevels,
    ];
    if (!sameArray(validationKey, eligibility)) validated = new Map();
    validationKey = eligibility;
    const nextValidated = new Map<
      string,
      { item: ItemInstance; valid: boolean }
    >();
    const valid: ItemInstance[] = [],
      unsupported: ItemInstance[] = [],
      invalidCustom: ItemInstance[] = [];
    for (const item of snapshot.inventory) {
      const cached = validated.get(item.instanceId);
      const result =
        cached?.item === item
          ? cached
          : { item, valid: !validateItem(snapshot, item).length };
      nextValidated.set(item.instanceId, result);
      if (!result.valid && item.source === "bag") unsupported.push(item);
      if (!result.valid && item.source === "custom") invalidCustom.push(item);
      if (
        result.valid &&
        !(purchasePreview && isConvertedCustom(item)) &&
        (item.source !== "purchase" ||
          candidateById.get(item.instanceId)?.available ||
          customRewardIds.has(item.itemId))
      )
        valid.push(item);
    }
    validated = nextValidated;

    // prepareGems/prepareEnchants resolve equipped gear plus this candidate. An
    // equipped override can change another row's JC/meta result; unrelated bag
    // overrides cannot. Keep the complete equipped baseline for palette/copy rules.
    const equippedIds = new Set(Object.values(snapshot.equipped));
    const equippedDependencies = snapshot.inventory
      .filter((i) => equippedIds.has(i.instanceId))
      .flatMap((i) => [i, snapshot.itemEnhancements?.[i.instanceId]]);
    const globalDependencies = [
      ...eligibility,
      snapshot.gemming,
      snapshot.autoEnchant,
      snapshot.equipped,
      ...equippedDependencies,
    ];
    const nextPreviewCache = new Map<
      string,
      { dependencies: readonly unknown[]; item: ItemInstance }
    >();
    const byId = new Map<string, InventoryRowView>();
    for (const item of snapshot.inventory) {
      const dependencies = [
        ...globalDependencies,
        item,
        snapshot.itemEnhancements?.[item.instanceId],
      ];
      const cached = previewCache.get(item.instanceId);
      let preview = cached?.item;
      if (!cached || !sameArray(cached.dependencies, dependencies)) {
        try {
          preview = previewItemEnhancements(snapshot, item);
        } catch {
          preview = item;
        }
        if (cached && sameItem(cached.item, preview)) preview = cached.item;
        else if (sameItem(item, preview)) preview = item;
      }
      nextPreviewCache.set(item.instanceId, { dependencies, item: preview! });
      const row: InventoryRowView = {
        item,
        preview: preview!,
        selected: selected.has(item.instanceId),
        usesResources:
          !!purchaseCatalog?.byItemId.has(item.itemId) &&
          (item.source === "custom" || item.source === "purchase"),
        unavailable:
          item.source === "purchase" &&
          !candidateById.get(item.instanceId)?.available,
        disabled: !purchasePreview && isConvertedCustom(item),
        removable:
          item.source === "custom" ||
          (item.source === "purchase" && customRewardIds.has(item.itemId)),
      };
      const old = previous?.byId.get(item.instanceId);
      byId.set(item.instanceId, old && sameRecord(old, row) ? old : row);
    }
    previewCache = nextPreviewCache;
    const groupKey = [...eligibility, !!purchaseCatalog, ...valid];
    let groups = previous?.groups;
    if (!groups || !sameArray(groupingKey, groupKey)) {
      const nextGroups = new Map<Slot, readonly string[]>();
      for (const slot of groupSlots) {
        const ids = orderPurchaseVariants(
          valid.filter((item) =>
            slotGroup(slot).some((position) =>
              canEquip(snapshot, catalog.items.get(item.itemId)!, position),
            ),
          ),
          (item) =>
            item.source === "purchase"
              ? purchaseCatalog?.byItemId.get(item.itemId)
              : undefined,
          snapshot.specId,
          snapshot.settings.player!.class,
        ).map((item) => item.instanceId);
        const old = groups?.get(slot);
        nextGroups.set(slot, old && sameArray(old, ids) ? old : ids);
      }
      if (
        !groups ||
        [...nextGroups].some(([slot, ids]) => groups?.get(slot) !== ids)
      )
        groups = nextGroups;
      groupingKey = groupKey;
    }
    const view: InventoryView = {
      byId:
        previous &&
        previous.byId.size === byId.size &&
        [...byId].every(([id, row]) => previous!.byId.get(id) === row)
          ? previous.byId
          : byId,
      groups,
      unsupported:
        previous && sameArray(previous.unsupported, unsupported)
          ? previous.unsupported
          : unsupported,
      invalidCustom:
        previous && sameArray(previous.invalidCustom, invalidCustom)
          ? previous.invalidCustom
          : invalidCustom,
      selectedCount: selectedIds.length,
      totalCount: valid.length,
      snapshot,
      selection,
    };
    previousDraft = draft;
    previousPreview = purchasePreview;
    return (previous =
      previous && sameRecord(previous, view) ? previous : view);
  };
}

export type NonPurchaseView = {
  allowance: Allowance;
  enhancementAnalysis: ReturnType<typeof analyzeItemEnhancementSets> | null;
};
export function createNonPurchaseSelector(): (
  state: GearLabState,
  policy: WorkPolicy | null,
) => NonPurchaseView | null {
  const selectInput = createAnalysisInputSelector();
  let previousInput: AnalysisInput | null = null;
  let previous: NonPurchaseView | null = null;
  return (state, policy) => {
    const input = selectInput(state, policy);
    if (!input || input.request.purchases) {
      previousInput = null;
      return (previous = null);
    }
    if (input === previousInput) return previous;
    const { snapshot, selection } = input.request;
    const enhancementAnalysis = Object.keys(snapshot.itemEnhancements ?? {})
      .length
      ? analyzeItemEnhancementSets(snapshot, selection)
      : null;
    const allowance = estimateAllowance(
      snapshot,
      selection,
      input.policy,
      undefined,
      enhancementAnalysis ?? undefined,
    );
    previousInput = input;
    return (previous = { allowance, enhancementAnalysis });
  };
}

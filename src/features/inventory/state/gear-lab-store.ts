import {
  addCustomItems as addCustomItemsToRequest,
  removeCustomItem as removeCustomItemFromRequest,
} from "@/domain/equipment/custom-items";
import { defaultGemming, validateGemming } from "@/domain/equipment/gemming";
import { setItemEnhancements as setOwnedItemEnhancements } from "@/domain/equipment/item-enhancements";
import { validateItem } from "@/domain/equipment/validate";
import { setPurchaseEnhancements as setRewardEnhancements } from "@/domain/purchases/enhancements";
import type { ResourceId } from "@/domain/purchases/model";
import {
  removeResource as removePurchaseResource,
  revalidatePurchaseInputs,
  setPurchaseExcluded,
  setResourceBalance,
} from "@/domain/purchases/state";
import { purchaseVariants } from "@/domain/purchases/variants";
import {
  itemVersionOf,
  itemVersions,
  type ItemVersion,
} from "@/domain/top-gear/item-version";
import type {
  GemmingSettings,
  ItemEnhancementOverride,
  Slot,
  Snapshot,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface GearLabActions {
  replaceDraft(draft: TopGearRequest | null): void;
  setIterations(value: number, policy: WorkPolicy): void;
  toggleItem(instanceId: string): void;
  setPurchaseIncluded(itemId: number, included: boolean): void;
  setResourceQuantity(id: ResourceId, quantity: number): void;
  saveResource(input: {
    previousId?: ResourceId;
    id: ResourceId;
    quantity: number;
    gearVariant: string;
  }): void;
  removeResource(id: ResourceId): void;
  setGearVariant(variant: string): void;
  addCustomItems(slot: Slot, itemIds: number[]): void;
  removeCustomItem(instanceId: string): void;
  setItemEnhancements(instanceId: string, value: ItemEnhancementOverride): void;
  setPurchaseEnhancements(itemId: number, value: ItemEnhancementOverride): void;
  setGemming(value: GemmingSettings): void;
  setAutoEnchant(value: boolean): void;
  setItemVersion(version: ItemVersion): void;
  applySettings(
    value: Pick<
      Snapshot,
      "specId" | "settings" | "provenance" | "professionLevels"
    >,
  ): void;
  revalidatePurchases(): number[];
}

export type GearLabState = {
  draft: TopGearRequest | null;
  epoch: number;
  actions: GearLabActions;
};

export type GearLabStore = StoreApi<GearLabState>;

function normalizeDraft(draft: TopGearRequest | null): TopGearRequest | null {
  if (!draft) return null;

  const excluded = draft.snapshot.inventory
    .filter(
      (item) =>
        item.source === "bag" && validateItem(draft.snapshot, item).length > 0,
    )
    .map((item) => item.instanceId);

  return {
    ...draft,
    snapshot: {
      ...draft.snapshot,
      gemming: draft.snapshot.gemming ?? defaultGemming(draft.snapshot),
      autoEnchant: draft.snapshot.autoEnchant ?? true,
    },
    selection: {
      ...draft.selection,
      selectedInstanceIds: draft.selection.selectedInstanceIds.filter(
        (id) => !excluded.includes(id),
      ),
      acknowledgedExclusions: excluded,
      lockedSlots: {},
    },
  };
}

function sameArray<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameRecord(
  a: Readonly<Record<string, unknown>> | undefined,
  b: Readonly<Record<string, unknown>> | undefined,
) {
  if (a === b) return true;
  const aEntries = Object.entries(a ?? {}),
    bEntries = Object.entries(b ?? {});
  return (
    aEntries.length === bEntries.length &&
    aEntries.every(([key, value]) => b?.[key] === value)
  );
}

function sameEnhancements(
  a: ItemEnhancementOverride | undefined,
  b: ItemEnhancementOverride,
) {
  const canonicalGems = (values: ItemEnhancementOverride["gemIds"]) => {
    const gems = [...(values ?? [])];
    while (gems.length && gems.at(-1) == null) gems.pop();
    return gems;
  };
  const aGems = canonicalGems(a?.gemIds),
    bGems = canonicalGems(b.gemIds);
  return a?.enchantId === b.enchantId && sameArray(aGems, bGems);
}

function revalidateBagSelections(request: TopGearRequest): TopGearRequest {
  const excluded = request.snapshot.inventory
    .filter(
      (item) =>
        item.source === "bag" &&
        validateItem(request.snapshot, item).length > 0,
    )
    .map((item) => item.instanceId);
  const selected = request.selection.selectedInstanceIds.filter(
    (id) => !excluded.includes(id),
  );
  if (
    sameArray(selected, request.selection.selectedInstanceIds) &&
    sameArray(excluded, request.selection.acknowledgedExclusions)
  )
    return request;
  return {
    ...request,
    selection: {
      ...request.selection,
      selectedInstanceIds: selected,
      acknowledgedExclusions: excluded,
    },
  };
}

function withValidatedVariant(request: TopGearRequest, variant: string) {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  if (!purchaseVariants(request.snapshot).includes(variant))
    throw new Error("Purchase gear variant is not eligible for this character");
  if (request.purchases.gearVariant === variant) return request;
  return {
    ...request,
    purchases: { ...request.purchases, gearVariant: variant },
  };
}

export function createGearLabStore(
  initial: TopGearRequest | null = null,
): GearLabStore {
  return createStore<GearLabState>()((set) => ({
    draft: normalizeDraft(initial),
    epoch: 0,
    actions: {
      replaceDraft: (draft) =>
        set((state) => ({
          draft: normalizeDraft(draft),
          epoch: state.epoch + 1,
        })),
      setIterations: (value, policy) =>
        set((state) => {
          const range = policy.selectableIterations;
          if (
            !state.draft ||
            !range ||
            !Number.isFinite(value) ||
            value < range.min ||
            value > range.max ||
            (value - range.min) % range.step !== 0 ||
            state.draft.iterations === value
          ) {
            return state;
          }
          return { draft: { ...state.draft, iterations: value } };
        }),
      toggleItem: (instanceId) =>
        set((state) => {
          const request = state.draft;
          if (!request) return state;
          const item = request.snapshot.inventory.find(
            (candidate) => candidate.instanceId === instanceId,
          );
          const selected = request.selection.selectedInstanceIds;
          const included = selected.includes(instanceId);
          if (
            !item ||
            (!included && validateItem(request.snapshot, item).length)
          )
            return state;
          return {
            draft: {
              ...request,
              selection: {
                ...request.selection,
                selectedInstanceIds: included
                  ? selected.filter((id) => id !== instanceId)
                  : [...selected, instanceId],
              },
            },
          };
        }),
      setPurchaseIncluded: (itemId, included) =>
        set((state) => {
          const request = state.draft;
          if (!request?.purchases) return state;
          const excluded =
            request.purchases.excludedItemIds[
              itemVersionOf(request.snapshot)
            ] ?? [];
          if (excluded.includes(itemId) === !included) return state;
          return { draft: setPurchaseExcluded(request, itemId, !included) };
        }),
      setResourceQuantity: (id, quantity) =>
        set((state) => {
          if (!state.draft) return state;
          if (state.draft.purchases?.balances[id] === quantity) return state;
          return { draft: setResourceBalance(state.draft, id, quantity) };
        }),
      saveResource: ({ previousId, id, quantity, gearVariant }) =>
        set((state) => {
          if (!state.draft) return state;
          if (!purchaseVariants(state.draft.snapshot).includes(gearVariant))
            throw new Error(
              "Purchase gear variant is not eligible for this character",
            );
          let next = state.draft;
          if (next.purchases?.balances[id] !== quantity)
            next = setResourceBalance(next, id, quantity);
          if (previousId && previousId !== id)
            next = removePurchaseResource(next, previousId);
          next = withValidatedVariant(next, gearVariant);
          return next === state.draft ? state : { draft: next };
        }),
      removeResource: (id) =>
        set((state) => {
          if (
            !state.draft?.purchases ||
            !(id in state.draft.purchases.balances)
          )
            return state;
          return { draft: removePurchaseResource(state.draft, id) };
        }),
      setGearVariant: (variant) =>
        set((state) => {
          if (!state.draft) return state;
          const next = withValidatedVariant(state.draft, variant);
          return next === state.draft ? state : { draft: next };
        }),
      addCustomItems: (slot, itemIds) =>
        set((state) => {
          if (!state.draft || !itemIds.length) return state;
          const owned = new Set(
            state.draft.snapshot.inventory.map((item) => item.itemId),
          );
          if (itemIds.every((itemId) => owned.has(itemId))) return state;
          const next = revalidateBagSelections(
            addCustomItemsToRequest(state.draft, slot, itemIds),
          );
          return next === state.draft ? state : { draft: next };
        }),
      removeCustomItem: (instanceId) =>
        set((state) => {
          if (!state.draft) return state;
          let next = removeCustomItemFromRequest(state.draft, instanceId);
          if (
            next !== state.draft &&
            next.snapshot.itemEnhancements &&
            !Object.keys(next.snapshot.itemEnhancements).length
          ) {
            next = {
              ...next,
              snapshot: { ...next.snapshot, itemEnhancements: undefined },
            };
          }
          return next === state.draft ? state : { draft: next };
        }),
      setItemEnhancements: (instanceId, value) =>
        set((state) => {
          if (!state.draft) return state;
          if (
            sameEnhancements(
              state.draft.snapshot.itemEnhancements?.[instanceId],
              value,
            )
          )
            return state;
          return {
            draft: setOwnedItemEnhancements(state.draft, instanceId, value),
          };
        }),
      setPurchaseEnhancements: (itemId, value) =>
        set((state) => {
          if (!state.draft?.purchases) return state;
          const current =
            state.draft.purchases.itemEnhancements[
              itemVersionOf(state.draft.snapshot)
            ]?.[String(itemId)];
          if (current !== undefined && sameEnhancements(current, value))
            return state;
          if (
            current === undefined &&
            sameEnhancements(undefined, value) &&
            !state.draft.snapshot.inventory.some(
              (item) =>
                item.source === "custom" &&
                item.itemId === itemId &&
                state.draft!.selection.selectedInstanceIds.includes(
                  item.instanceId,
                ),
            )
          )
            return state;
          return { draft: setRewardEnhancements(state.draft, itemId, value) };
        }),
      setGemming: (value) =>
        set((state) => {
          if (!state.draft) return state;
          const current = state.draft.snapshot.gemming;
          if (
            current?.enabled === value.enabled &&
            current.defaultGemId === value.defaultGemId &&
            current.metaGemId === value.metaGemId &&
            current.jcGemId === value.jcGemId
          )
            return state;
          validateGemming({ ...state.draft.snapshot, gemming: value });
          return {
            draft: {
              ...state.draft,
              snapshot: { ...state.draft.snapshot, gemming: value },
            },
          };
        }),
      setAutoEnchant: (value) =>
        set((state) => {
          if (!state.draft || state.draft.snapshot.autoEnchant === value)
            return state;
          return {
            draft: {
              ...state.draft,
              snapshot: { ...state.draft.snapshot, autoEnchant: value },
            },
          };
        }),
      setItemVersion: (version) =>
        set((state) => {
          if (!state.draft || itemVersionOf(state.draft.snapshot) === version)
            return state;
          let next: TopGearRequest = {
            ...state.draft,
            snapshot: {
              ...state.draft.snapshot,
              itemVersion: version,
              itemDataRevision: itemVersions[version].revision,
              provenance: {
                ...state.draft.snapshot.provenance,
                itemVersion: "edited",
              },
            },
          };
          next = revalidateBagSelections(next);
          return { draft: next };
        }),
      applySettings: (value) =>
        set((state) => {
          if (!state.draft) return state;
          const snapshot = state.draft.snapshot;
          if (
            snapshot.specId === value.specId &&
            snapshot.settings === value.settings &&
            sameRecord(snapshot.provenance, value.provenance) &&
            sameRecord(snapshot.professionLevels, value.professionLevels)
          )
            return state;
          let next: TopGearRequest = {
            ...state.draft,
            snapshot: { ...snapshot, ...value },
          };
          next = revalidateBagSelections(next);
          return { draft: next };
        }),
      revalidatePurchases: () => {
        let removedItemIds: number[] = [];
        set((state) => {
          if (!state.draft) return state;
          const result = revalidatePurchaseInputs(state.draft);
          removedItemIds = result.removedItemIds;
          return result.request === state.draft
            ? state
            : { draft: result.request };
        });
        return removedItemIds;
      },
    },
  }));
}

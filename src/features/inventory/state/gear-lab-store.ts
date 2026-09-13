import { defaultGemming } from "@/domain/equipment/gemming";
import { validateItem } from "@/domain/equipment/validate";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface GearLabActions {
  replaceDraft(draft: TopGearRequest | null): void;
  setIterations(value: number, policy: WorkPolicy): void;
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
    },
  }));
}

import { encodeRequest } from "@/domain/top-gear/request-schema";
import type { TopGearRequest } from "@/domain/top-gear/model";
import {
  clearDraft,
  clearMatchingDraft,
  saveDraft,
} from "@/features/import/draft-store";
import type { GearLabStore } from "./gear-lab-store";

const writeDelayMs = 250;

export type DraftPersistence = {
  flush(): void;
  cancel(): void;
  discard(): void;
  complete(submitted: ReturnType<typeof encodeRequest>): void;
  dispose(options?: { flush?: boolean }): void;
};

export function createDraftPersistence(
  store: GearLabStore,
  options: {
    save: typeof saveDraft;
    clear: typeof clearDraft;
    clearMatching: typeof clearMatchingDraft;
    onError: (error: unknown) => void;
  },
): DraftPersistence {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let handledDraft: TopGearRequest | null | undefined;
  let observedDraft = store.getState().draft;
  let observedEpoch = store.getState().epoch;
  let disposed = false;

  function cancelTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function persistCurrent() {
    const draft = store.getState().draft;
    if (!draft || draft === handledDraft) return;
    options.save(draft);
    handledDraft = draft;
  }

  function schedule(draft: TopGearRequest | null) {
    cancelTimer();
    if (!draft || draft === handledDraft) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        persistCurrent();
      } catch (error) {
        options.onError(error);
      }
    }, writeDelayMs);
  }

  const unsubscribe = store.subscribe((state) => {
    if (state.draft === observedDraft && state.epoch === observedEpoch) return;
    observedDraft = state.draft;
    observedEpoch = state.epoch;
    schedule(state.draft);
  });

  function flush() {
    cancelTimer();
    persistCurrent();
  }

  function cancel() {
    cancelTimer();
  }

  function discard() {
    cancelTimer();
    options.clear();
    store.getState().actions.replaceDraft(null);
  }

  function complete(submitted: ReturnType<typeof encodeRequest>) {
    cancelTimer();
    persistCurrent();
    const current = store.getState().draft;
    if (options.clearMatching(submitted)) handledDraft = current;
  }

  function dispose(disposeOptions: { flush?: boolean } = {}) {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    cancelTimer();
    if (disposeOptions.flush ?? true) persistCurrent();
  }

  return { flush, cancel, discard, complete, dispose };
}

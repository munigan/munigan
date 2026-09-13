"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { WorkPolicy } from "@/domain/top-gear/model";
import { useGearLabStore } from "./GearLabProvider";
import {
  createAnalysisController,
  type AnalysisController,
  type AnalysisView,
} from "./gear-lab-analysis";
import {
  createAnalysisInputSelector,
  createNonPurchaseSelector,
  type NonPurchaseView,
} from "./gear-lab-selectors";
import type { GearLabStore } from "./gear-lab-store";

const createWorker = () =>
  new Worker(
    new URL("../purchases/purchase-analysis.worker.ts", import.meta.url),
    { type: "module" },
  );
type SessionView = {
  controller: AnalysisController;
  view: AnalysisView;
  nonPurchase: NonPurchaseView | null;
};

/** The effect owns each controller's lifetime; the external subscription survives
 * Strict Mode's setup/cleanup replay without reviving a disposed controller. */
function createAnalysisSession(store: GearLabStore) {
  const selectInput = createAnalysisInputSelector();
  const selectNonPurchase = createNonPurchaseSelector();
  const listeners = new Set<() => void>();
  let policy: WorkPolicy | null = null;
  let controller = createAnalysisController(createWorker);
  let snapshot: SessionView = {
    controller,
    view: controller.getSnapshot(),
    nonPurchase: null,
  };
  let unsubscribeStore: (() => void) | null = null;
  let unsubscribeController: (() => void) | null = null;
  const readNonPurchase = () => selectNonPurchase(store.getState(), policy);
  const refresh = () => {
    const view = controller.getSnapshot();
    const nonPurchase = readNonPurchase();
    if (
      snapshot.controller === controller &&
      snapshot.view === view &&
      snapshot.nonPurchase === nonPurchase
    )
      return;
    snapshot = { controller, view, nonPurchase };
    for (const listener of listeners) listener();
  };
  const sync = () => {
    controller.update(selectInput(store.getState(), policy));
    refresh();
  };
  return {
    start() {
      controller = createAnalysisController(createWorker);
      unsubscribeController = controller.subscribe(refresh);
      unsubscribeStore = store.subscribe(sync);
      sync();
    },
    stop() {
      unsubscribeStore?.();
      unsubscribeController?.();
      unsubscribeStore = unsubscribeController = null;
      controller.dispose();
    },
    setPolicy(next: WorkPolicy | null) {
      policy = next;
      sync();
    },
    readNonPurchase,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useGearLabAnalysis(
  policy: WorkPolicy | null,
): SessionView & { readNonPurchase(): NonPurchaseView | null } {
  const store = useGearLabStore();
  const session = useMemo(() => createAnalysisSession(store), [store]);
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  useEffect(() => {
    session.setPolicy(policy);
  }, [session, policy]);
  return { ...snapshot, readNonPurchase: session.readNonPurchase };
}

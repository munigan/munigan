"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { useGearLabStore } from "./GearLabProvider";
import { createAnalysisSession } from "./useGearLabAnalysis";
import {
  createInventorySelector,
  type InventoryView,
} from "./gear-lab-selectors";
import type { PurchasePreview } from "../purchases/purchase-worker-contract";

export function createGearLabRuntime(
  store: ReturnType<typeof useGearLabStore>,
) {
  const session = createAnalysisSession(store);
  const selectInventory = createInventorySelector();
  return {
    session,
    store,
    subscribe(listener: () => void) {
      const a = store.subscribe(listener),
        b = session.subscribe(listener);
      return () => {
        a();
        b();
      };
    },
    inventory(
      preview: PurchasePreview | null = session.getSnapshot().view.preview,
    ) {
      const draft = store.getState().draft;
      return draft ? selectInventory(draft, preview) : null;
    },
  };
}
type Runtime = ReturnType<typeof createGearLabRuntime>;
const RuntimeContext = createContext<Runtime | null>(null);
export function GearLabRuntimeProvider({
  children,
  runtime: suppliedRuntime,
}: PropsWithChildren<{ runtime?: Runtime }>) {
  const store = useGearLabStore();
  const runtime = useMemo(
    () => suppliedRuntime ?? createGearLabRuntime(store),
    [store, suppliedRuntime],
  );
  useEffect(() => {
    runtime.session.start();
    return () => runtime.session.stop();
  }, [runtime]);
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
export function useGearLabRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("Gear Lab runtime is required");
  return runtime;
}
export function useAnalysisView() {
  const { session } = useGearLabRuntime();
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
}
export function useInventoryView<T>(selector: (view: InventoryView) => T) {
  const runtime = useGearLabRuntime();
  const read = () => selector(runtime.inventory()!);
  return useSyncExternalStore(runtime.subscribe, read, read);
}

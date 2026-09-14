"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { useStore } from "zustand";
import {
  createGearLabStore,
  type GearLabState,
  type GearLabStore,
} from "./gear-lab-store";

const GearLabStoreContext = createContext<GearLabStore | null>(null);

export function GearLabProvider({
  children,
  store: suppliedStore,
}: PropsWithChildren<{ store?: GearLabStore }>) {
  const [store] = useState(() => suppliedStore ?? createGearLabStore());
  return (
    <GearLabStoreContext.Provider value={store}>
      {children}
    </GearLabStoreContext.Provider>
  );
}

export function useGearLabStore(): GearLabStore {
  const store = useContext(GearLabStoreContext);
  if (!store) {
    throw new Error("Gear Lab store hooks must be used within GearLabProvider");
  }
  return store;
}

export function useGearLabSelector<T>(selector: (state: GearLabState) => T): T {
  return useStore(useGearLabStore(), selector);
}

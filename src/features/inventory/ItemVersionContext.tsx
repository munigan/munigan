"use client";
import { createContext, useContext } from "react";
import type { ItemVersion } from "@/domain/top-gear/item-version";

export const ItemVersionContext = createContext<ItemVersion>("classic");
export const useItemVersion = () => useContext(ItemVersionContext);

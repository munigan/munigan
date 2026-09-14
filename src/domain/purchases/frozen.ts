import type { Snapshot } from "@/domain/top-gear/model";
import type { FrozenPurchases } from "./model";

export function hydratePurchaseSnapshot(
  original: Snapshot,
  frozen: FrozenPurchases,
): Snapshot {
  const ids = new Set(original.inventory.map((item) => item.instanceId));
  for (const item of frozen.generatedItems) {
    if (ids.has(item.instanceId))
      throw new Error(`Duplicate generated item ID: ${item.instanceId}`);
    ids.add(item.instanceId);
  }
  return {
    ...original,
    inventory: [
      ...original.inventory,
      ...structuredClone(frozen.generatedItems),
    ],
    itemEnhancements: structuredClone({
      ...original.itemEnhancements,
      ...frozen.effectiveEnhancements,
    }),
  };
}

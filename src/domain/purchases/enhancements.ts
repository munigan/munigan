import { getCatalog } from "@/domain/equipment/catalog";
import { setItemEnhancements } from "@/domain/equipment/item-enhancements";
import { validateItem } from "@/domain/equipment/validate";
import {
  itemVersionOf,
  type ItemVersion,
} from "@/domain/top-gear/item-version";
import type {
  Diagnostic,
  ItemEnhancementOverride,
  ItemInstance,
  Snapshot,
  TopGearRequest,
} from "@/domain/top-gear/model";
import { getPurchaseCatalog } from "./catalog";
import { purchaseInstanceId, validatePurchaseInputs } from "./schema";

/** A targeted reset/edit remains possible even when preparation rejects an override. */
export class PurchaseEnhancementError extends Error {
  constructor(
    readonly profile: ItemVersion,
    readonly itemId: number,
    readonly diagnostics: Diagnostic[],
  ) {
    super(diagnostics[0]?.message ?? "Invalid purchase enhancement");
    this.name = "PurchaseEnhancementError";
  }
}

/** The same empty reward is used by preparation and the enhancement editor. */
export function purchaseItem(snapshot: Snapshot, itemId: number): ItemInstance {
  return {
    instanceId: purchaseInstanceId(itemVersionOf(snapshot), itemId),
    itemId,
    source: "purchase",
    gemIds: [],
    enchantId: 0,
  };
}

export function setPurchaseEnhancements(
  request: TopGearRequest,
  itemId: number,
  override: ItemEnhancementOverride,
): TopGearRequest {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  const profile = itemVersionOf(request.snapshot);
  validatePurchaseInputs(request.purchases, profile);
  const recipe = getPurchaseCatalog(profile).byItemId.get(itemId);
  const item = purchaseItem(request.snapshot, itemId);
  if (
    !recipe ||
    recipe.classId !== request.snapshot.settings.player!.class ||
    validateItem(request.snapshot, item, getCatalog(profile)).length
  )
    throw new Error("Purchase item is not eligible for this character");
  // Reuse both per-item validation and sparse override normalization.
  const edited = setItemEnhancements(
    {
      ...request,
      snapshot: {
        ...request.snapshot,
        inventory: [...request.snapshot.inventory, item],
      },
    },
    item.instanceId,
    override,
  );
  const normalized = edited.snapshot.itemEnhancements?.[item.instanceId];
  const overrides = { ...request.purchases.itemEnhancements[profile] };
  if (normalized) overrides[String(itemId)] = normalized;
  else delete overrides[String(itemId)];
  return {
    ...request,
    purchases: {
      ...request.purchases,
      itemEnhancements: {
        ...request.purchases.itemEnhancements,
        [profile]: overrides,
      },
    },
  };
}

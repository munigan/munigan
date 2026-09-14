import { getCatalog } from "@/domain/equipment/catalog";
import {
  setItemEnhancements,
  validateItemEnhancements,
} from "@/domain/equipment/item-enhancements";
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

/** Construct effective reward intent without candidate or acquisition search.
 * Callers check reward registration and character eligibility separately.
 */
export function effectivePurchaseItem(
  request: TopGearRequest,
  itemId: number,
): { instance: ItemInstance; override?: ItemEnhancementOverride } {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  const profile = itemVersionOf(request.snapshot);
  const instance = purchaseItem(request.snapshot, itemId);
  const custom = request.snapshot.inventory
    .filter(
      (item) =>
        item.source === "custom" &&
        item.itemId === itemId &&
        request.selection.selectedInstanceIds.includes(item.instanceId),
    )
    .sort((a, b) =>
      a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
    )[0];
  const inherited = custom
    ? {
        ...(custom.enchantId ? { enchantId: custom.enchantId } : {}),
        ...request.snapshot.itemEnhancements?.[custom.instanceId],
      }
    : undefined;
  const explicit =
    request.purchases.itemEnhancements[profile]?.[String(itemId)];
  const override = explicit ?? inherited;
  // Preserve raw custom gems separately from sparse overrides so null/omitted
  // sockets still participate in existing whole-set JC and meta automation.
  // An explicit purchase override (including {}) suppresses all inheritance.
  const effectiveInstance =
    custom && explicit === undefined
      ? { ...instance, gemIds: [...custom.gemIds] }
      : instance;
  if (!override) return { instance: effectiveInstance };
  const errors = validateItemEnhancements(request.snapshot, instance, override);
  if (errors.length)
    throw new PurchaseEnhancementError(profile, itemId, errors);
  return {
    instance: effectiveInstance,
    override: {
      ...override,
      ...(override.gemIds ? { gemIds: [...override.gemIds] } : {}),
    },
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
  const inheritsCustomIntent = request.snapshot.inventory.some(
    (candidate) =>
      candidate.source === "custom" &&
      candidate.itemId === itemId &&
      request.selection.selectedInstanceIds.includes(candidate.instanceId),
  );
  // Empty is an explicit default choice for converted customs. Deleting it
  // would reactivate the original custom intent on the next preparation.
  if (normalized || inheritsCustomIntent)
    overrides[String(itemId)] = normalized ?? {};
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

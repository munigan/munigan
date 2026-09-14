import { getCatalog } from "@/domain/equipment/catalog";
import { validateItem } from "@/domain/equipment/validate";
import type { SearchBudget } from "@/domain/equipment/search-budget";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import type {
  ItemEnhancementOverride,
  TopGearRequest,
} from "@/domain/top-gear/model";
import { getPurchaseCatalog } from "./catalog";
import { acquisitionPaths } from "./acquisition";
import { purchaseItem, effectivePurchaseItem } from "./enhancements";
import type {
  PreparedPurchases,
  PurchaseCandidate,
  PurchaseRecipe,
  ResourceId,
} from "./model";
import { defaultPurchaseVariant, purchaseVariants } from "./variants";
import { validatePurchaseInputs } from "./schema";

export function preparePurchases(
  request: TopGearRequest,
  budget: SearchBudget,
): PreparedPurchases {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  const profile = itemVersionOf(request.snapshot);
  validatePurchaseInputs(request.purchases, profile);
  const catalog = getPurchaseCatalog(profile),
    equipment = getCatalog(profile);
  const variant =
    request.purchases.gearVariant ?? defaultPurchaseVariant(request.snapshot);
  if (variant && !purchaseVariants(request.snapshot).includes(variant))
    throw new Error("Invalid purchase gear specialization for this class");
  const selected = new Set(request.selection.selectedInstanceIds);
  const replaced = request.snapshot.inventory.filter(
    (i) =>
      i.source === "custom" &&
      selected.has(i.instanceId) &&
      catalog.byItemId.has(i.itemId),
  );
  const replacedIds = new Set(replaced.map((i) => i.instanceId));
  const enhancements: Record<string, ItemEnhancementOverride> = {
    ...request.snapshot.itemEnhancements,
  };
  const prepared: PreparedPurchases = {
    snapshot: {
      ...request.snapshot,
      inventory: [...request.snapshot.inventory],
      itemEnhancements: enhancements,
    },
    selection: {
      ...request.selection,
      selectedInstanceIds: request.selection.selectedInstanceIds.filter(
        (id) => !replacedIds.has(id),
      ),
      lockedSlots: { ...request.selection.lockedSlots },
    },
    inputs: request.purchases,
    catalog,
    candidates: [],
  };
  const ownedIds = new Set(
    request.snapshot.inventory
      .filter((i) => i.source === "bag" || i.source === "equipped")
      .map((i) => i.itemId),
  );
  function missing(recipe: PurchaseRecipe): PurchaseCandidate["missing"] {
    budget.visit();
    const reasons: PurchaseCandidate["missing"] = Object.entries(
      recipe.cost,
    ).flatMap(([id, amount]) => {
      const quantity =
        amount - (prepared.inputs.balances[id as ResourceId] ?? 0);
      return quantity > 0 ? [{ resourceId: id as ResourceId, quantity }] : [];
    });
    if (
      recipe.prerequisiteItemId !== undefined &&
      !ownedIds.has(recipe.prerequisiteItemId)
    ) {
      const previous = catalog.byItemId.get(recipe.prerequisiteItemId);
      const unavailable = previous ? missing(previous) : [];
      if (!previous || unavailable.length)
        reasons.push(
          { itemId: recipe.prerequisiteItemId, quantity: 1 },
          ...unavailable,
        );
    }
    return reasons;
  }
  for (const recipe of catalog.recipes) {
    budget.visit();
    if (recipe.classId !== request.snapshot.settings.player!.class) continue;
    // Physical copies remain selectable in inventory. Only an explicit custom
    // comparison may request an additional, separately costed copy.
    if (
      ownedIds.has(recipe.itemId) &&
      !replaced.some((item) => item.itemId === recipe.itemId)
    )
      continue;
    if (
      variant &&
      recipe.setVariant !== variant &&
      !replaced.some((item) => item.itemId === recipe.itemId)
    )
      continue;
    const instance = purchaseItem(request.snapshot, recipe.itemId);
    if (validateItem(request.snapshot, instance, equipment).length) continue;
    const { instance: effectiveInstance, override } = effectivePurchaseItem(
      request,
      recipe.itemId,
    );
    if (override) enhancements[instance.instanceId] = override;
    const paths = acquisitionPaths(
      prepared,
      [{ itemId: recipe.itemId, resultId: instance.instanceId }],
      new Set(),
      budget,
    );
    const candidate: PurchaseCandidate = {
      instance,
      recipeId: recipe.id,
      included: !request.purchases.excludedItemIds[profile]?.includes(
        recipe.itemId,
      ),
      available: paths.length > 0,
      missing: paths.length ? [] : missing(recipe),
      paths,
    };
    prepared.candidates.push(candidate);
    prepared.snapshot.inventory.push(effectiveInstance);
    if (candidate.available && candidate.included)
      prepared.selection.selectedInstanceIds.push(instance.instanceId);
  }
  // A locked custom reward follows its costed representation. An unavailable
  // replacement intentionally leaves no selected match, yielding no legal set.
  for (const [slot, id] of Object.entries(prepared.selection.lockedSlots)) {
    const custom = replaced.find((i) => i.instanceId === id);
    if (custom)
      prepared.selection.lockedSlots[
        slot as keyof typeof prepared.selection.lockedSlots
      ] = purchaseItem(request.snapshot, custom.itemId).instanceId;
  }
  return prepared;
}

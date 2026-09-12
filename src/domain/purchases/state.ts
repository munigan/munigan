import { getPurchaseCatalog } from "./catalog";
import { canonicalizePurchaseInputs, resourceIds } from "./schema";
import type { PurchaseInputs, ResourceId } from "./model";
import {
  itemVersionOf,
  type ItemVersion,
} from "@/domain/top-gear/item-version";
import type { TopGearRequest } from "@/domain/top-gear/model";

function createInputs(request: TopGearRequest): PurchaseInputs {
  const profile = itemVersionOf(request.snapshot);
  return {
    version: 1,
    recipeRevision: getPurchaseCatalog(profile).revision,
    balances: {},
    excludedItemIds: {},
    itemEnhancements: {},
  };
}

function withoutPurchases(request: TopGearRequest): TopGearRequest {
  const copy = { ...request };
  delete copy.purchases;
  return copy;
}

export function setResourceBalance(
  request: TopGearRequest,
  id: ResourceId,
  quantity: number,
): TopGearRequest {
  if (!(resourceIds as readonly string[]).includes(id))
    throw new Error("Unknown purchase resource");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000)
    throw new Error("Invalid purchase resource quantity");
  const current = request.purchases ?? createInputs(request);
  return {
    ...request,
    purchases: {
      ...current,
      balances: { ...current.balances, [id]: quantity },
    },
  };
}

export function removeResource(
  request: TopGearRequest,
  id: ResourceId,
): TopGearRequest {
  if (!request.purchases) return request;
  const balances = { ...request.purchases.balances };
  delete balances[id];
  if (!Object.keys(balances).length) return withoutPurchases(request);
  return {
    ...request,
    purchases: { ...request.purchases, balances },
  };
}

export function setPurchaseExcluded(
  request: TopGearRequest,
  itemId: number,
  excluded: boolean,
): TopGearRequest {
  const profile = itemVersionOf(request.snapshot);
  if (!Number.isInteger(itemId) || itemId <= 0 || itemId > 10_000_000)
    throw new Error("Invalid purchase item ID");
  if (!getPurchaseCatalog(profile).byItemId.has(itemId))
    throw new Error(`Unknown purchase item ${itemId}`);
  if (!request.purchases) return request;
  const excludedItemIds = { ...request.purchases.excludedItemIds };
  const values = new Set(excludedItemIds[profile] ?? []);
  if (excluded) values.add(itemId);
  else values.delete(itemId);
  if (values.size) excludedItemIds[profile] = [...values].sort((a, b) => a - b);
  else delete excludedItemIds[profile];
  return {
    ...request,
    purchases: { ...request.purchases, excludedItemIds },
  };
}

export function revalidatePurchaseInputs(request: TopGearRequest): {
  request: TopGearRequest;
  removedItemIds: number[];
} {
  if (!request.purchases) return { request, removedItemIds: [] };
  const removed = new Set<number>();
  const excludedItemIds: PurchaseInputs["excludedItemIds"] = {};
  const itemEnhancements: PurchaseInputs["itemEnhancements"] = {};
  for (const [profile, values] of Object.entries(
    request.purchases.excludedItemIds,
  )) {
    const catalog = getPurchaseCatalog(profile as ItemVersion);
    const retained = [...new Set(values)]
      .filter((itemId) => {
        const present = catalog.byItemId.has(itemId);
        if (!present) removed.add(itemId);
        return present;
      })
      .sort((a, b) => a - b);
    if (retained.length) excludedItemIds[profile as ItemVersion] = retained;
  }
  for (const [profile, values] of Object.entries(
    request.purchases.itemEnhancements,
  )) {
    const catalog = getPurchaseCatalog(profile as ItemVersion);
    const retained = Object.fromEntries(
      Object.entries(values)
        .filter(([itemId]) => {
          const numericId = Number(itemId);
          const present = catalog.byItemId.has(numericId);
          if (!present) removed.add(numericId);
          return present;
        })
        .sort(([a], [b]) => Number(a) - Number(b)),
    );
    if (Object.keys(retained).length)
      itemEnhancements[profile as ItemVersion] = retained;
  }
  const purchases = canonicalizePurchaseInputs({
    ...request.purchases,
    recipeRevision: getPurchaseCatalog(itemVersionOf(request.snapshot))
      .revision,
    excludedItemIds,
    itemEnhancements,
  });
  return {
    request: purchases ? { ...request, purchases } : withoutPurchases(request),
    removedItemIds: [...removed].sort((a, b) => a - b),
  };
}

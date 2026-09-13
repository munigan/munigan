import Image from "next/image";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { defaultPurchaseVariant } from "@/domain/purchases/variants";
import { validateItem } from "@/domain/equipment/validate";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type { ResourceId } from "@/domain/purchases/model";
import { ItemImage } from "../Item";

export function ResourceImage({
  request,
  resourceId,
}: {
  request: TopGearRequest;
  resourceId: ResourceId;
}) {
  const emblem =
    resourceId === "frost"
      ? "inv_misc_frostemblem_01"
      : resourceId === "triumph"
        ? "spell_holy_summonchampion"
        : undefined;
  if (emblem)
    return (
      <Image
        className="resource-wallet-icon rounded"
        unoptimized
        src={`https://wow.zamimg.com/images/wow/icons/large/${emblem}.jpg`}
        width={36}
        height={36}
        alt=""
      />
    );
  const variant =
    request.purchases?.gearVariant ?? defaultPurchaseVariant(request.snapshot);
  const recipe = getPurchaseCatalog(
    itemVersionOf(request.snapshot),
  ).recipes.find(
    (r) =>
      r.slot === "chest" &&
      r.classId === request.snapshot.settings.player!.class &&
      (!variant || r.setVariant === variant) &&
      r.cost[resourceId] &&
      !validateItem(request.snapshot, {
        instanceId: "resource-image",
        itemId: r.itemId,
        source: "purchase",
        gemIds: [],
        enchantId: 0,
      }).length,
  );
  return recipe ? <ItemImage itemId={recipe.itemId} size={36} /> : null;
}

import Image from "next/image";
import { useTranslations } from "next-intl";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
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
  const t = useTranslations("inventory.purchases");
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
  const recipes = getPurchaseCatalog(
    itemVersionOf(request.snapshot),
  ).recipes.filter(
    (r) =>
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
  const recipe = recipes.find((item) => item.slot === "chest");
  if (!recipe) return null;
  const equipment = getCatalog(itemVersionOf(request.snapshot));
  const label = t("representedItems", { count: recipes.length });
  return (
    <TooltipRoot>
      <TooltipTrigger
        type="button"
        className="resource-items-trigger"
        aria-label={label}
        delay={250}
      >
        <ItemImage itemId={recipe.itemId} size={36} />
        <span className="resource-items-count" aria-hidden="true">
          +{recipes.length}
        </span>
      </TooltipTrigger>
      <TooltipContent role="tooltip">
        <strong>{label}</strong>
        <ul className="resource-items-list">
          {recipes.map((item) => (
            <li key={item.id}>
              {equipment.items.get(item.itemId)?.name ?? String(item.itemId)}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </TooltipRoot>
  );
}

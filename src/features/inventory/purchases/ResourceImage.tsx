import { memo } from "react";
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

export const ResourceImage = memo(
  function ResourceImage({
    request,
    resourceId,
    decorative = false,
  }: {
    request: TopGearRequest;
    resourceId: ResourceId;
    decorative?: boolean;
  }) {
    const t = useTranslations("inventory.purchases");
    const emblem =
      resourceId === "heroism"
        ? "spell_holy_proclaimchampion"
        : resourceId === "valor"
          ? "spell_holy_proclaimchampion_02"
          : resourceId === "conquest"
            ? "spell_holy_championsgrace"
            : resourceId === "frost"
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
      request.purchases?.gearVariant ??
      defaultPurchaseVariant(request.snapshot);
    const recipes = getPurchaseCatalog(
      itemVersionOf(request.snapshot),
    ).recipes.filter(
      (r) =>
        r.classId === request.snapshot.settings.player!.class &&
        (!variant || r.setVariant === variant) &&
        [r.cost, ...(r.alternativeCosts ?? [])].some(
          (cost) => cost[resourceId],
        ) &&
        !validateItem(request.snapshot, {
          instanceId: "resource-image",
          itemId: r.itemId,
          source: "purchase",
          gemIds: [],
          enchantId: 0,
        }).length,
    );
    const recipe = recipes.find((item) => item.slot === "chest") ?? recipes[0];
    if (!recipe) return null;
    if (decorative) return <ItemImage itemId={recipe.itemId} size={32} />;
    const ownedIds = new Set(
      request.snapshot.inventory
        .filter((item) => item.source === "bag" || item.source === "equipped")
        .map((item) => item.itemId),
    );
    const remaining = recipes.filter((item) => !ownedIds.has(item.itemId));
    const equipment = getCatalog(itemVersionOf(request.snapshot));
    const label = t("representedItems", { count: remaining.length });
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
            +{remaining.length}
          </span>
        </TooltipTrigger>
        <TooltipContent role="tooltip">
          <strong>{label}</strong>
          <ul className="resource-items-list">
            {remaining.map((item) => (
              <li key={item.id}>
                {equipment.items.get(item.itemId)?.name ?? String(item.itemId)}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </TooltipRoot>
    );
  },
  (a, b) =>
    a.decorative === b.decorative &&
    a.resourceId === b.resourceId &&
    a.request.purchases?.gearVariant === b.request.purchases?.gearVariant &&
    a.request.snapshot.itemVersion === b.request.snapshot.itemVersion &&
    a.request.snapshot.specId === b.request.snapshot.specId &&
    a.request.snapshot.settings === b.request.snapshot.settings &&
    a.request.snapshot.professionLevels ===
      b.request.snapshot.professionLevels &&
    a.request.snapshot.inventory === b.request.snapshot.inventory,
);

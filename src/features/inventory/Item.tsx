"use client";
import { useTranslations } from "next-intl";
import { ItemType } from "@/generated/wotlk/common";
import { extraSocketLabel } from "@/domain/equipment/sockets";
import { useState, type ComponentProps } from "react";
import Image from "next/image";
import type { ItemInstance } from "@/domain/top-gear/model";
import { useItemVersion } from "./ItemVersionContext";
import { ClassicCompactItemLink } from "./ClassicCompactItemLink";
import { getCatalog } from "@/domain/equipment/catalog";
export function ItemImage({
  itemId,
  size = 44,
}: {
  itemId: number;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const catalog = getCatalog(useItemVersion());
  const item =
    catalog.items.get(itemId) ??
    catalog.gems.get(itemId) ??
    catalog.icons?.get(itemId);
  const icon = item?.icon;
  return (
    <span className="item-icon" style={{ width: size, height: size }}>
      {icon && !failed ? (
        <Image
          unoptimized
          src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">?</span>
      )}
    </span>
  );
}
export function ItemIcon({
  item,
  size = 44,
  children,
  ...props
}: {
  item: ItemInstance;
  size?: number;
  tooltipOnly?: boolean;
} & ComponentProps<"a">) {
  const t = useTranslations("common");
  const catalog = getCatalog(useItemVersion());
  const metadata =
    catalog.items.get(item.itemId) ??
    catalog.gems.get(item.itemId) ??
    catalog.icons?.get(item.itemId);
  return (
    <ItemLink
      item={item}
      data-item-icon
      aria-label={
        children
          ? undefined
          : (metadata?.name ?? t("itemFallback", { id: item.itemId }))
      }
      {...props}
    >
      <ItemImage key={item.itemId} itemId={item.itemId} size={size} />
      {children}
    </ItemLink>
  );
}
export function ItemLink({
  item,
  tooltipOnly = false,
  className,
  ...props
}: { item: ItemInstance; tooltipOnly?: boolean } & ComponentProps<"a">) {
  const version = useItemVersion();
  return (
    <ClassicCompactItemLink
      item={item}
      version={version}
      tooltipOnly={tooltipOnly}
      {...props}
      className={["item-link", className].filter(Boolean).join(" ")}
    />
  );
}
export function ItemName({ item }: { item: ItemInstance }) {
  const t = useTranslations("inventory");
  const catalog = getCatalog(useItemVersion());
  return (
    <span className="item-name">
      {catalog.items.get(item.itemId)?.name ??
        catalog.gems.get(item.itemId)?.name ??
        catalog.icons?.get(item.itemId)?.name ??
        t("item.unknown", { id: item.itemId })}
    </span>
  );
}
export function ItemDetails({ item }: { item: ItemInstance }) {
  const t = useTranslations("inventory");
  const version = useItemVersion();
  const catalog = getCatalog(version),
    meta = catalog.items.get(item.itemId);
  return (
    <details className="item-details">
      <summary
        aria-label={t("item.detailsFor", { name: meta?.name ?? item.itemId })}
      >
        {t("item.details")}
      </summary>
      <div>
        <strong>{meta?.name ?? t("item.id", { id: item.itemId })}</strong>
        <p>
          {t("item.id", { id: item.itemId })} ·{" "}
          {item.source === "bag"
            ? t("item.carried")
            : item.source === "custom"
              ? t("item.custom")
              : item.source === "purchase"
                ? t("sources.purchase")
                : t("sources.equipped")}
        </p>
        <p>
          {t("item.enchantLabel")}{" "}
          {item.enchantId
            ? (catalog.enchants.get(item.enchantId)?.[0]?.name ??
              item.enchantId)
            : t("item.none")}
        </p>
        <p>
          {t("item.gemsLabel")}{" "}
          {item.gemIds.length
            ? item.gemIds
                .map((id) =>
                  id
                    ? (catalog.gems.get(id)?.name ?? String(id))
                    : t("item.emptySocket"),
                )
                .join(" · ")
            : t("item.none")}
        </p>
        {extraSocketLabel(meta, item.gemIds.length) && (
          <p>
            {t("item.extraSocket", {
              name:
                meta?.type !== ItemType.ItemTypeWaist
                  ? t("item.blacksmithSocket")
                  : extraSocketLabel(meta, item.gemIds.length)!,
            })}
          </p>
        )}
        <ItemLink item={item}>{t("item.fullDetails")}</ItemLink>
      </div>
    </details>
  );
}

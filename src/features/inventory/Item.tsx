"use client";
import { useState, type ComponentProps } from "react";
import Image from "next/image";
import type { ItemInstance } from "@/domain/top-gear/model";
import { useItemVersion } from "./ItemVersionContext";
import { OriginalItemLink } from "./OriginalItemLink";
import { getCatalog } from "@/domain/equipment/catalog";
export function ItemIcon({
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
export function ItemLink({
  item,
  tooltipOnly = false,
  ...props
}: { item: ItemInstance; tooltipOnly?: boolean } & ComponentProps<"a">) {
  const version = useItemVersion();
  if (version === "original")
    return (
      <OriginalItemLink item={item} tooltipOnly={tooltipOnly} {...props} />
    );
  const options = `ench=${item.enchantId}&gems=${item.gemIds.join(":")}`;
  return (
    <a
      {...props}
      href={`https://www.wowhead.com/wotlk/item=${item.itemId}`}
      data-wowhead={options}
      target="_blank"
      rel="noreferrer"
      // Wowhead requires an anchor URL to resolve Wrath data. Passive bag icons
      // expose image semantics and prevent navigation while retaining tooltips.
      role={tooltipOnly ? "img" : props.role}
      tabIndex={tooltipOnly ? 0 : props.tabIndex}
      draggable={tooltipOnly ? false : props.draggable}
      onClick={tooltipOnly ? (event) => event.preventDefault() : props.onClick}
      onAuxClick={
        tooltipOnly ? (event) => event.preventDefault() : props.onAuxClick
      }
      onContextMenu={
        tooltipOnly ? (event) => event.preventDefault() : props.onContextMenu
      }
    />
  );
}
export function ItemName({ item }: { item: ItemInstance }) {
  const catalog = getCatalog(useItemVersion());
  return (
    <span className="item-name">
      {catalog.items.get(item.itemId)?.name ??
        catalog.gems.get(item.itemId)?.name ??
        catalog.icons?.get(item.itemId)?.name ??
        `Unknown item ${item.itemId}`}
    </span>
  );
}
export function ItemDetails({ item }: { item: ItemInstance }) {
  const version = useItemVersion();
  const catalog = getCatalog(version),
    meta = catalog.items.get(item.itemId);
  return (
    <details className="item-details">
      <summary aria-label={`Details for ${meta?.name ?? item.itemId}`}>
        Details
      </summary>
      <div>
        <strong>{meta?.name ?? `Item ${item.itemId}`}</strong>
        <p>
          Item {item.itemId} ·{" "}
          {item.source === "bag" ? "Carried in bags" : "Equipped"}
        </p>
        <p>
          Enchant:{" "}
          {item.enchantId
            ? (catalog.enchants.get(item.enchantId)?.[0]?.name ??
              item.enchantId)
            : "None"}
        </p>
        <p>
          Gems:{" "}
          {item.gemIds.length
            ? item.gemIds
                .map((id) =>
                  id
                    ? (catalog.gems.get(id)?.name ?? String(id))
                    : "Empty socket",
                )
                .join(" · ")
            : "None"}
        </p>
        <ItemLink item={item}>
          View on {version === "original" ? "Cavern of Time" : "Wowhead"} ↗
        </ItemLink>
      </div>
    </details>
  );
}

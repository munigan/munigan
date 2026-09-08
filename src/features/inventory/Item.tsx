"use client";
import { useState, type ComponentProps } from "react";
import Image from "next/image";
import type { ItemInstance } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
export function ItemIcon({
  itemId,
  size = 44,
}: {
  itemId: number;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const item = getCatalog().items.get(itemId) ?? getCatalog().gems.get(itemId);
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
  ...props
}: { item: ItemInstance } & ComponentProps<"a">) {
  const options = `ench=${item.enchantId}&gems=${item.gemIds.join(":")}`;
  return (
    <a
      {...props}
      href={`https://www.wowhead.com/wotlk/item=${item.itemId}`}
      data-wowhead={options}
      target="_blank"
      rel="noreferrer"
    />
  );
}
export function ItemName({ item }: { item: ItemInstance }) {
  return (
    <span className="item-name">
      {getCatalog().items.get(item.itemId)?.name ??
        getCatalog().gems.get(item.itemId)?.name ??
        `Unknown item ${item.itemId}`}
    </span>
  );
}
export function ItemDetails({ item }: { item: ItemInstance }) {
  const catalog = getCatalog(),
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
        <ItemLink item={item}>View on Wowhead ↗</ItemLink>
      </div>
    </details>
  );
}

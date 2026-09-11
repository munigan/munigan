"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getCatalog } from "@/domain/equipment/catalog";
import type { ItemInstance } from "@/domain/top-gear/model";
import { ItemIcon } from "@/features/inventory/Item";
import { useItemVersion } from "@/features/inventory/ItemVersionContext";
import "./bag-preview.css";

const rarityColors: Record<number, string> = {
  0: "#575751",
  1: "#77766b",
  2: "#398b35",
  3: "#357bb6",
  4: "#705b81",
  5: "#bf8038",
  6: "#bda969",
  7: "#bda969",
};

function Satchel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 10V7c0-5 12-5 12 0v3M10 10h20l4 8-2 16H8L6 18l4-8ZM8 19l12 5 12-5M17 18h6v10h-6z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function BagPreview({
  items,
  label,
  describeItem,
}: {
  items: ItemInstance[];
  label?: string;
  describeItem?: (item: ItemInstance) => string;
}) {
  const t = useTranslations("import");
  const catalog = getCatalog(useItemVersion());
  const gridRef = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // Match decorative empty slots to the actual responsive grid, including
    // width changes from panels and scrollbars, without changing export data.
    const measure = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns;
      setColumns(tracks === "none" ? 1 : tracks.split(" ").length);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="wow-bag">
      <ul
        ref={gridRef}
        className="wow-bag-grid bag-grid"
        aria-label={label ?? t("importedBags")}
      >
        {items.map((item) => {
          const quality =
            catalog.items.get(item.itemId)?.quality ??
            catalog.gems.get(item.itemId)?.quality;
          const description = describeItem?.(item);
          const metadata =
            catalog.items.get(item.itemId) ??
            catalog.gems.get(item.itemId) ??
            catalog.icons?.get(item.itemId);
          return (
            <li
              className="wow-bag-slot"
              key={item.instanceId}
              style={
                {
                  "--bag-rarity":
                    rarityColors[quality ?? -1] ?? "var(--color-border)",
                } as CSSProperties
              }
            >
              <ItemIcon
                item={item}
                tooltipOnly
                className="bag-item"
                aria-label={
                  description
                    ? t("unsupportedItem", {
                        name:
                          metadata?.name ??
                          t("itemFallback", { id: item.itemId }),
                      })
                    : (metadata?.name ?? t("itemFallback", { id: item.itemId }))
                }
                aria-describedby={
                  description ? `reason-${item.instanceId}` : undefined
                }
              />
              {description && (
                <span className="sr-only" id={`reason-${item.instanceId}`}>
                  {description}
                </span>
              )}
            </li>
          );
        })}
        {/* These only finish the visual row; the export has no bag positions. */}
        {Array.from(
          {
            length: items.length
              ? (columns - (items.length % columns)) % columns
              : columns * 2,
          },
          (_, i) => (
            <li
              className="wow-bag-empty"
              key={i}
              aria-hidden="true"
              role="presentation"
            >
              <Satchel />
            </li>
          ),
        )}
      </ul>
      {!items.length && <span className="sr-only">{t("emptyBags")}</span>}
    </div>
  );
}

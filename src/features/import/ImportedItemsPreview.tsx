"use client";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { BagPreview } from "./BagPreview";
import type { ItemInstance } from "@/domain/top-gear/model";
import { ItemIcon } from "@/features/inventory/Item";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";

/** Shared by the live export preview and the import review. */
export const ImportedItemsPreview = memo(function ImportedItemsPreview({
  items,
  bags = false,
}: {
  items: ItemInstance[];
  bags?: boolean;
}) {
  const t = useTranslations("import");
  return (
    <ItemVersionContext value="original">
      <section
        className={bags ? "min-w-0" : "import-equipment min-w-0"}
        aria-label={bags ? t("bagPreview") : t("equippedPreview")}
      >
        {!bags && (
          <div className="import-review-heading">
            <h3>{t("equippedGear")}</h3>
            <span className="muted small">
              {t("equippedCount", { count: items.length })}
            </span>
          </div>
        )}
        {bags ? (
          <BagPreview items={items} />
        ) : (
          <div className="import-equipped-icons" aria-label={t("importedGear")}>
            {items.map((item) => (
              <ItemIcon key={item.instanceId} item={item} size={38} />
            ))}
          </div>
        )}
      </section>
    </ItemVersionContext>
  );
});

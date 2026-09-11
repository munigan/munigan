import { useLocale, useTranslations } from "next-intl";
import { EnchantImage } from "./enhancements/EnchantImage";
import { itemEnchantOptions } from "./enhancements/enchant-options";
import type { ItemInstance, Snapshot } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import { itemSockets } from "@/domain/equipment/sockets";
import { ItemIcon } from "./Item";
import { gemDescription } from "./gem-labels";
import { statLines } from "./stat-labels";

export type EnhancementField = number | "enchant";
export function ItemEnhancementPreview({
  item,
  snapshot,
  onEdit,
}: {
  item: ItemInstance;
  snapshot: Snapshot;
  onEdit: (field: EnhancementField) => void;
}) {
  const t = useTranslations("inventory"),
    locale = useLocale();
  const catalog = getCatalog(snapshot.itemVersion);
  const metadata = catalog.items.get(item.itemId)!;
  const sockets = itemSockets(snapshot, metadata);
  const enchants = itemEnchantOptions(snapshot, metadata);
  const enchant = enchants.find((e) => e.effectId === item.enchantId);
  const override = snapshot.itemEnhancements?.[item.instanceId];
  if (!sockets.length && !enchants.length) return null;
  return (
    <div className="item-enhancement-preview">
      {sockets.map((_, index) => {
        const id = item.gemIds[index] ?? 0,
          gem = catalog.gems.get(id);
        const name = gem?.name ?? t("editor.emptySocket");
        const label = t("editor.openGem", { index: index + 1, name });
        const activate = () => onEdit(index);
        return id ? (
          <ItemIcon
            key={index}
            item={{ ...item, itemId: id, enchantId: 0, gemIds: [] }}
            size={24}
            role="button"
            className="item-enhancement-gem"
            aria-label={label}
            title={`${name}${gem ? ` · ${gemDescription(gem, t, locale)}` : ""}`}
            data-enhancement-field={index}
            data-manual={override?.gemIds?.[index] != null}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              activate();
            }}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                activate();
              }
            }}
          />
        ) : (
          <button
            key={index}
            type="button"
            className="item-enhancement-gem item-enhancement-empty"
            aria-label={label}
            title={name}
            data-enhancement-field={index}
            onClick={(e) => {
              e.stopPropagation();
              activate();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m3 8 4-5h10l4 5-9 13ZM3 8h18M7 3l5 18 5-18" />
            </svg>
          </button>
        );
      })}
      {enchants.length > 0 && (
        <button
          type="button"
          className="item-enhancement-enchant"
          data-enhancement-field="enchant"
          data-manual={override?.enchantId !== undefined}
          aria-label={t("editor.openEnchant", {
            name: enchant?.name ?? t("editor.noEnchant"),
          })}
          title={
            enchant
              ? [enchant.name, ...statLines(enchant.stats, t, locale)].join(
                  " · ",
                )
              : t("editor.noEnchant")
          }
          onClick={(e) => {
            e.stopPropagation();
            onEdit("enchant");
          }}
        >
          <EnchantImage enchant={enchant} size={24} />
        </button>
      )}
    </div>
  );
}

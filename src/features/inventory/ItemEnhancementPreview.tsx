import { useLocale, useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { EnchantImage } from "./enhancements/EnchantImage";
import { itemEnchantOptions } from "./enhancements/enchant-options";
import type { ItemInstance, Snapshot } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import { itemSockets } from "@/domain/equipment/sockets";
import { ItemIcon } from "./Item";
import { gemDescription } from "./gem-labels";
import { enchantDescription } from "./enhancements/enchant-description";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";

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
  const enchantName = enchant?.name ?? t("editor.noEnchant");
  const enchantDetails = enchant ? enchantDescription(enchant, t, locale) : "";
  // The catalog's itemId can identify a recipe, not an applied enchant.
  // Spell references consistently describe the enchant itself.
  const enchantTarget = enchant?.spellId ? `spell=${enchant.spellId}` : null;
  const override = snapshot.itemEnhancements?.[item.instanceId];
  const enchantTriggerProps = {
    className: "item-enhancement-enchant",
    "data-enhancement-field": "enchant",
    "data-manual": override?.enchantId !== undefined,
    "aria-label": [
      t("editor.openEnchant", { name: enchantName }),
      enchantDetails,
    ]
      .filter(Boolean)
      .join(" · "),
    onClick: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onEdit("enchant");
    },
  };
  const enchantTooltip = [enchantName, enchantDetails]
    .filter(Boolean)
    .join(" · ");
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
            size={20}
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
              width="14"
              height="14"
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
      {enchants.length > 0 &&
        (enchantTarget ? (
          <a
            {...enchantTriggerProps}
            href={`https://www.wowhead.com/wotlk/${enchantTarget}`}
            data-wowhead=""
            role="button"
            target="_blank"
            rel="noreferrer"
            title={enchantTooltip}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onEdit("enchant");
              }
            }}
          >
            <EnchantImage enchant={enchant} size={20} />
          </a>
        ) : (
          <TooltipRoot>
            <TooltipTrigger {...enchantTriggerProps} type="button">
              <EnchantImage enchant={enchant} size={20} />
            </TooltipTrigger>
            <TooltipContent>{enchantTooltip}</TooltipContent>
          </TooltipRoot>
        ))}
    </div>
  );
}

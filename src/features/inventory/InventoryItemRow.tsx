import { memo, useCallback, useMemo } from "react";
import { useGearLabSelector } from "./state/GearLabProvider";
import { useGearLabRuntime, useInventoryView } from "./state/GearLabRuntime";
import { createRowPresentationSelector } from "./state/gear-lab-selectors";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ItemSourceIcon } from "@/components/items/ItemSourceIcon";
import type { ItemInstance, Snapshot } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import { ItemIcon, ItemName, ItemLink } from "./Item";
import {
  ItemEnhancementPreview,
  type EnhancementField,
} from "./ItemEnhancementPreview";
import { itemSockets } from "@/domain/equipment/sockets";
import { itemEnchantOptions } from "./enhancements/enchant-options";
import { PickerIcon } from "./custom-items/PickerIcon";

export function InventoryItemRow({
  item,
  preview,
  snapshot,
  index,
  selected,
  onToggle,
  onRemove,
  onEdit,
  usesResources = false,
  unavailable = false,
  disabled = false,
  removable,
}: {
  item: ItemInstance;
  preview: ItemInstance;
  snapshot: Snapshot;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: (field: EnhancementField) => void;
  usesResources?: boolean;
  unavailable?: boolean;
  disabled?: boolean;
  removable?: boolean;
}) {
  const t = useTranslations("inventory");
  const metadata = getCatalog(snapshot.itemVersion).items.get(item.itemId)!;
  const source = t(`sources.${item.source}`);
  const hasSockets = itemSockets(snapshot, metadata).length > 0;
  const editable =
    !disabled &&
    (hasSockets || itemEnchantOptions(snapshot, metadata).length > 0);
  const open = () => {
    if (editable) onEdit(hasSockets ? 0 : "enchant");
  };
  return (
    <div
      className="inventory-row"
      data-editable={editable}
      data-source={item.source}
      data-selected={selected}
      data-instance-id={item.instanceId}
      onClick={editable ? open : undefined}
    >
      <div className="item-choice">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled || unavailable}
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          aria-label={t("selectItem", {
            name: metadata.name,
            source,
            copy: index + 1,
          })}
        />
        <ItemIcon
          item={preview}
          className="item-tooltip-link item-row-icon"
          tabIndex={-1}
          onClick={
            editable
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  open();
                }
              : undefined
          }
        />
        <div className="item-row-copy">
          <ItemLink
            item={preview}
            className="item-tooltip-link"
            role={editable ? "button" : undefined}
            aria-label={
              editable
                ? t("editor.openItem", { name: metadata.name })
                : undefined
            }
            onClick={
              editable
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    open();
                  }
                : undefined
            }
            onKeyDown={(event) => {
              if (editable && event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                open();
              }
            }}
          >
            <ItemName item={item} />
          </ItemLink>
          {usesResources && (
            <span className="purchase-row-source">
              {t("purchases.usesResources")}
              {unavailable ? ` · ${t("purchases.unavailable")}` : ""}
            </span>
          )}
          <div className="item-row-details">
            <span className="item-mobile-meta">
              <span aria-label={t("itemLevel")}>{metadata.ilvl}</span>{" "}
              <ItemSourceIcon source={item.source} />
            </span>
            <ItemEnhancementPreview
              item={preview}
              snapshot={snapshot}
              disabled={disabled}
              onEdit={(field) => {
                if (editable) onEdit(field);
              }}
            />
          </div>
        </div>
      </div>
      <span className="item-level" aria-label={t("itemLevel")}>
        {metadata.ilvl}
      </span>
      <span className="item-source">
        <ItemSourceIcon source={item.source} />
      </span>
      <span className="item-remove-space">
        {(removable ?? item.source === "custom") && (
          <Button
            variant="ghost"
            aria-label={t("removeItem", { name: metadata.name })}
            className="item-remove size-8 min-h-8 p-0 text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <PickerIcon name="trash" />
          </Button>
        )}
      </span>
    </div>
  );
}

export const ConnectedInventoryItemRow = memo(
  function ConnectedInventoryItemRow({
    id,
    index,
    onEdit,
  }: {
    id: string;
    index: number;
    onEdit: (id: string, field: EnhancementField) => void;
  }) {
    const runtime = useGearLabRuntime();
    const actions = useGearLabSelector((state) => state.actions);
    const row = useInventoryView((view) => view.byId.get(id));
    const selectSnapshot = useMemo(
      () => createRowPresentationSelector(id),
      [id],
    );
    const snapshot = useInventoryView(selectSnapshot);
    const onToggle = useCallback(() => {
      if (!row) return;
      if (row.item.source === "purchase")
        actions.setPurchaseIncluded(row.item.itemId, !row.selected);
      else actions.toggleItem(id);
    }, [actions, row, id]);
    if (!row) return null;
    return (
      <InventoryItemRow
        {...row}
        snapshot={snapshot}
        index={index}
        onToggle={onToggle}
        onEdit={(field) => onEdit(id, field)}
        onRemove={() => {
          const original =
            row.item.source === "purchase"
              ? runtime.store
                  .getState()
                  .draft!.snapshot.inventory.find(
                    (item) =>
                      item.source === "custom" &&
                      item.itemId === row.item.itemId,
                  )?.instanceId
              : id;
          if (original) actions.removeCustomItem(original);
        }}
      />
    );
  },
);

"use client";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useTranslations } from "next-intl";
import { BagPreview } from "@/features/import/BagPreview";
import { SectionHeading } from "@/components/ui/layout";
import { Button } from "@/components/ui/Button";
import { forwardRef, useMemo, useRef, useState } from "react";
import type { TopGearRequest, Slot } from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import { getCatalog } from "@/domain/equipment/catalog";
import { canEquip, validateItem } from "@/domain/equipment/validate";
import { slotGroupLabel } from "./item-labels";
import { InventoryItemRow } from "./InventoryItemRow";
import { AddCustomItem } from "./custom-items/CustomItemPicker";
import { removeCustomItem, slotGroup } from "@/domain/equipment/custom-items";
import { InventoryFilterIcon } from "./InventoryFilterIcon";
import { previewItemEnhancements } from "@/domain/equipment/item-enhancements";
import { ItemEnhancementEditor } from "./enhancements/ItemEnhancementEditor";
import type { EnhancementField } from "./ItemEnhancementPreview";
import "./item-enhancement-preview.css";
import {
  InventoryEnhancementIssues,
  type EnhancementSetAnalysis,
} from "./InventoryEnhancementIssues";
const filterKeys = {
  "All slots": "all",
  Armor: "armor",
  Weapons: "weapons",
  "Rings & trinkets": "accessories",
} as const;
export const InventorySelector = forwardRef<
  HTMLElement,
  {
    request: TopGearRequest;
    onChange: (r: TopGearRequest) => void;
    enhancementAnalysis?: EnhancementSetAnalysis | null;
  }
>(function InventorySelector(
  { request, onChange, enhancementAnalysis = null },
  forwardedRef,
) {
  const d = useTranslations("diagnostics");
  const t = useTranslations("inventory");
  const [filter, setFilter] = useState("All slots");
  const { snapshot, selection } = request,
    catalog = getCatalog(snapshot.itemVersion);
  const [editing, setEditing] = useState<{
    id: string;
    field: EnhancementField;
  } | null>(null);
  const editorReturnFocus = useRef<HTMLElement | null>(null);
  const previews = useMemo(
    () =>
      new Map(
        snapshot.inventory.map((item) => {
          try {
            return [
              item.instanceId,
              previewItemEnhancements(snapshot, item),
            ] as const;
          } catch {
            // Invalid imported settings remain editable; admission explains the issue.
            return [item.instanceId, item] as const;
          }
        }),
      ),
    [snapshot],
  );
  const editedItem = snapshot.inventory.find(
    (item) => item.instanceId === editing?.id,
  );
  const valid = snapshot.inventory.filter(
      (i) => !validateItem(snapshot, i).length,
    ),
    unsupported = snapshot.inventory.filter(
      (i) => i.source === "bag" && validateItem(snapshot, i).length,
    );
  const groupSlots = slots.filter(
    (s) => s !== "finger2" && s !== "trinket2" && s !== "offHand",
  );
  const items = (s: Slot) =>
    valid.filter((i) =>
      slotGroup(s).some((slot) =>
        canEquip(snapshot, catalog.items.get(i.itemId)!, slot),
      ),
    );
  function toggle(id: string) {
    onChange({
      ...request,
      selection: {
        ...selection,
        selectedInstanceIds: selection.selectedInstanceIds.includes(id)
          ? selection.selectedInstanceIds.filter((itemId) => itemId !== id)
          : [...selection.selectedInstanceIds, id],
      },
    });
  }
  const shown = groupSlots.filter((s) =>
    filter === "Armor"
      ? slots.indexOf(s) < 10
      : filter === "Weapons"
        ? slots.indexOf(s) >= 14
        : filter === "Rings & trinkets"
          ? s === "finger1" || s === "trinket1"
          : true,
  );
  return (
    <section
      ref={forwardedRef}
      className="inventory"
      tabIndex={-1}
      aria-label={t("equipment")}
    >
      <SectionHeading className="section-top items-start">
        <h2>
          {t("equipment")}{" "}
          <span className="muted small">
            {t("selectionRatio", {
              selected: selection.selectedInstanceIds.length,
              total: valid.length,
            })}
          </span>
        </h2>
      </SectionHeading>
      <div className="filter-bar">
        <div className="segmented">
          {(["All slots", "Armor", "Weapons", "Rings & trinkets"] as const).map(
            (f) => (
              <Button
                variant="secondary"
                key={t(`filters.${filterKeys[f]}`)}
                className="aria-pressed:bg-selected-surface aria-pressed:border-control-border"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                <InventoryFilterIcon name={f} />
                {t(`filters.${filterKeys[f]}`)}
              </Button>
            ),
          )}
        </div>
      </div>
      <InventoryEnhancementIssues
        request={request}
        analysis={enhancementAnalysis}
        onChange={onChange}
        onEdit={(id, field) => {
          editorReturnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setEditing({ id, field });
        }}
      />
      {unsupported.length > 0 && (
        <details className="unsupported-bag">
          <summary>
            {t("unsupportedCount", { count: unsupported.length })}
          </summary>
          <BagPreview
            items={unsupported}
            label={t("unsupportedItems")}
            describeItem={(item) =>
              localizeDiagnostic(validateItem(snapshot, item)[0], d)
            }
          />
        </details>
      )}
      {snapshot.inventory
        .filter(
          (i) => i.source === "custom" && validateItem(snapshot, i).length,
        )
        .map((item) => (
          <div className="custom-item-unavailable" key={item.instanceId}>
            <span>
              {localizeDiagnostic(validateItem(snapshot, item)[0], d)}
            </span>
            <Button
              variant="ghost"
              onClick={() =>
                onChange(removeCustomItem(request, item.instanceId))
              }
            >
              {t("removeCustom")}
            </Button>
          </div>
        ))}
      {shown.map((s) => {
        const values = items(s);
        return (
          <section key={s} className="slot-group">
            <div className="section-top">
              <h3>{slotGroupLabel(s, t)} </h3>
              <span className="slot-selected-count muted small">
                {t("selectedCount", {
                  count: values.filter((i) =>
                    selection.selectedInstanceIds.includes(i.instanceId),
                  ).length,
                })}
              </span>
            </div>
            <div className="slot-items">
              {values.length === 0 ? (
                <div className="empty-slot">
                  <p>{t("emptySlot")}</p>
                </div>
              ) : (
                <>
                  {values.map((item, index) => (
                    <InventoryItemRow
                      key={item.instanceId}
                      item={item}
                      preview={previews.get(item.instanceId) ?? item}
                      snapshot={snapshot}
                      index={index}
                      selected={selection.selectedInstanceIds.includes(
                        item.instanceId,
                      )}
                      onToggle={() => toggle(item.instanceId)}
                      onEdit={(field) => {
                        editorReturnFocus.current =
                          document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null;
                        setEditing({ id: item.instanceId, field });
                      }}
                      onRemove={() =>
                        onChange(removeCustomItem(request, item.instanceId))
                      }
                    />
                  ))}
                </>
              )}
              <AddCustomItem request={request} slot={s} onChange={onChange} />
            </div>
          </section>
        );
      })}
      {editing && editedItem && (
        <ItemEnhancementEditor
          key={editedItem.instanceId}
          request={request}
          item={editedItem}
          initialField={editing.field}
          onApply={onChange}
          onClose={() => setEditing(null)}
          returnFocus={editorReturnFocus}
        />
      )}
    </section>
  );
});

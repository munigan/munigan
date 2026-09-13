"use client";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useTranslations } from "next-intl";
import { BagPreview } from "@/features/import/BagPreview";
import { SectionHeading } from "@/components/ui/layout";
import { Button } from "@/components/ui/Button";
import { memo, useCallback, useRef, useState } from "react";
import type { ItemInstance, Slot } from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import { validateItem } from "@/domain/equipment/validate";
import { slotGroupLabel } from "./item-labels";
import { ConnectedInventoryItemRow } from "./InventoryItemRow";
import { AddCustomItem } from "./custom-items/CustomItemPicker";
import { InventoryFilterIcon } from "./InventoryFilterIcon";
import { ItemEnhancementEditor } from "./enhancements/ItemEnhancementEditor";
import type { EnhancementField } from "./ItemEnhancementPreview";
import "./item-enhancement-preview.css";
import { InventoryEnhancementIssues } from "./InventoryEnhancementIssues";
import { useGearLabSelector } from "./state/GearLabProvider";
import {
  useAnalysisView,
  useGearLabRuntime,
  useInventoryView,
} from "./state/GearLabRuntime";
const filterKeys = {
  "All slots": "all",
  Armor: "armor",
  Weapons: "weapons",
  "Rings & trinkets": "accessories",
} as const;
const groupSlots = slots.filter(
  (s) => s !== "finger2" && s !== "trinket2" && s !== "offHand",
);
function SelectionSummary() {
  const t = useTranslations("inventory");
  const selected = useInventoryView((v) => v.selectedCount);
  const total = useInventoryView((v) => v.totalCount);
  return (
    <span className="muted small">
      {t("selectionRatio", { selected, total })}
    </span>
  );
}
function SlotSummary({ slot }: { slot: Slot }) {
  const t = useTranslations("inventory");
  const count = useInventoryView(
    (v) => v.groups.get(slot)!.filter((id) => v.byId.get(id)?.selected).length,
  );
  return (
    <span className="slot-selected-count muted small">
      {t("selectedCount", { count })}
    </span>
  );
}
const SlotGroup = memo(function SlotGroup({
  slot,
  onEdit,
}: {
  slot: Slot;
  onEdit: (id: string, field: EnhancementField) => void;
}) {
  const t = useTranslations("inventory");
  const ids = useInventoryView((v) => v.groups.get(slot)!);
  return (
    <section className="slot-group">
      <div className="section-top">
        <h3>{slotGroupLabel(slot, t)} </h3>
        <SlotSummary slot={slot} />
      </div>
      <div className="slot-items">
        {ids.length === 0 ? (
          <div className="empty-slot">
            <p>{t("emptySlot")}</p>
          </div>
        ) : (
          ids.map((id, index) => (
            <ConnectedInventoryItemRow
              key={id}
              id={id}
              index={index}
              onEdit={onEdit}
            />
          ))
        )}
        <ConnectedAddCustomItem slot={slot} />
      </div>
    </section>
  );
});
const ConnectedAddCustomItem = memo(function ConnectedAddCustomItem({
  slot,
}: {
  slot: Slot;
}) {
  const snapshot = useGearLabSelector((s) => s.draft!.snapshot);
  const runtime = useGearLabRuntime();
  const actions = useGearLabSelector((s) => s.actions);
  return (
    <AddCustomItem
      request={{ ...runtime.store.getState().draft!, snapshot }}
      slot={slot}
      onAdd={actions.addCustomItems}
    />
  );
});
function EnhancementIssues({
  onEdit,
}: {
  onEdit: (id: string, field: EnhancementField) => void;
}) {
  const snapshot = useGearLabSelector((s) => s.draft!.snapshot);
  const runtime = useGearLabRuntime();
  const analysis = useAnalysisView().nonPurchase?.enhancementAnalysis ?? null;
  return (
    <InventoryEnhancementIssues
      request={{ ...runtime.store.getState().draft!, snapshot }}
      analysis={analysis}
      onReset={(id) =>
        runtime.store.getState().actions.setItemEnhancements(id, {})
      }
      onEdit={onEdit}
    />
  );
}
const InvalidItems = memo(function InvalidItems({
  unsupported,
  invalidCustom,
}: {
  unsupported: readonly ItemInstance[];
  invalidCustom: readonly ItemInstance[];
}) {
  const d = useTranslations("diagnostics"),
    t = useTranslations("inventory");
  const snapshot = useInventoryView((v) => v.snapshot);
  const actions = useGearLabSelector((s) => s.actions);
  return (
    <>
      {unsupported.length > 0 && (
        <details className="unsupported-bag">
          <summary>
            {t("unsupportedCount", { count: unsupported.length })}
          </summary>
          <BagPreview
            items={[...unsupported]}
            label={t("unsupportedItems")}
            describeItem={(item) =>
              localizeDiagnostic(validateItem(snapshot, item)[0], d)
            }
          />
        </details>
      )}
      {invalidCustom.map((item) => (
        <div className="custom-item-unavailable" key={item.instanceId}>
          <span>{localizeDiagnostic(validateItem(snapshot, item)[0], d)}</span>
          <Button
            variant="ghost"
            onClick={() => actions.removeCustomItem(item.instanceId)}
          >
            {t("removeCustom")}
          </Button>
        </div>
      ))}
    </>
  );
});
export const InventorySelector = memo(function InventorySelector() {
  const t = useTranslations("inventory");
  const runtime = useGearLabRuntime();
  const unsupported = useInventoryView((v) => v.unsupported);
  const invalidCustom = useInventoryView((v) => v.invalidCustom);
  const [filter, setFilter] = useState("All slots");
  const [editing, setEditing] = useState<{
    id: string;
    field: EnhancementField;
  } | null>(null);
  const editorReturnFocus = useRef<HTMLElement | null>(null);
  const onEdit = useCallback(
    (id: string, field: EnhancementField) => {
      const row = runtime.inventory()?.byId.get(id);
      if (!row || (row.item.source === "custom" && row.usesResources)) return;
      editorReturnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setEditing({ id, field });
    },
    [runtime],
  );
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
    <section className="inventory">
      <SectionHeading className="section-top items-start">
        <h2>
          {t("equipment")} <SelectionSummary />
        </h2>
      </SectionHeading>
      <div className="filter-bar">
        <div className="segmented">
          {(["All slots", "Armor", "Weapons", "Rings & trinkets"] as const).map(
            (f) => (
              <Button
                variant="secondary"
                key={f}
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
      <EnhancementIssues onEdit={onEdit} />
      {(unsupported.length > 0 || invalidCustom.length > 0) && (
        <InvalidItems unsupported={unsupported} invalidCustom={invalidCustom} />
      )}
      {shown.map((slot) => (
        <SlotGroup key={slot} slot={slot} onEdit={onEdit} />
      ))}
      {editing && (
        <ConnectedEditor
          id={editing.id}
          field={editing.field}
          onClose={() => setEditing(null)}
          returnFocus={editorReturnFocus}
        />
      )}
    </section>
  );
});
function ConnectedEditor({
  id,
  field,
  onClose,
  returnFocus,
}: {
  id: string;
  field: EnhancementField;
  onClose: () => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const view = useInventoryView((v) => v);
  const runtime = useGearLabRuntime();
  const row = view.byId.get(id);
  if (!row || (row.item.source === "custom" && row.usesResources)) return null;
  const request = runtime.store.getState().draft!;
  const actions = runtime.store.getState().actions;
  return (
    <ItemEnhancementEditor
      key={id}
      request={
        row.item.source === "purchase"
          ? { ...request, snapshot: view.snapshot, selection: view.selection }
          : request
      }
      item={row.item}
      initialField={field}
      onApply={(value) =>
        row.item.source === "purchase"
          ? actions.setPurchaseEnhancements(row.item.itemId, value)
          : actions.setItemEnhancements(id, value)
      }
      onClose={onClose}
      returnFocus={returnFocus}
    />
  );
}

"use client";
import { localizedItemSources } from "./item-source-labels";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select, SelectOption } from "@/components/ui/Select";
import { useToastManager } from "@/components/ui/Toast";
import type { Slot, TopGearRequest } from "@/domain/top-gear/model";
import {
  addCustomItems,
  compatibleItems,
  emptyItemFilters,
  filterItems,
  itemType,
  type ItemFilters,
} from "@/domain/equipment/custom-items";
import { maxCustomItems } from "@/domain/equipment/custom-eligibility";
import { getCatalog } from "@/domain/equipment/catalog";
import { getSpec } from "@/features/settings/registry";
import { itemVersionOf, itemVersions } from "@/domain/top-gear/item-version";
import { slotGroupLabel } from "../item-labels";
import { PickerFilters } from "./PickerFilters";
import { PickerResults, pickerStats } from "./PickerResults";
import { PickerIcon } from "./PickerIcon";
import "./custom-items.css";

type Props = {
  request: TopGearRequest;
  slot: Slot;
  onChange: (r: TopGearRequest) => void;
};
export function AddCustomItem({ request, slot, onChange }: Props) {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" />}
        className="custom-item-entry border-0 border-t border-t-border first:border-t-0 hover:bg-[#15171a]"
        aria-label={t("picker.addToSlot", { slot: slotGroupLabel(slot, t) })}
      >
        <PickerIcon name="plus" size={20} />
        <span>
          <strong>{t("picker.addCustom")}</strong>
          <small>{t("picker.explore")}</small>
        </span>
        <PickerIcon name="arrow" />
      </DialogTrigger>
      {open && (
        <CustomItemPicker
          request={request}
          slot={slot}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </DialogRoot>
  );
}
function CustomItemPicker({
  request,
  slot,
  onChange,
  onClose,
}: Props & { onClose: () => void }) {
  const d = useTranslations("diagnostics");
  const t = useTranslations("inventory");
  const { snapshot } = request;
  const catalog = getCatalog(snapshot.itemVersion),
    spec = getSpec(snapshot.specId),
    slotName = slotGroupLabel(slot, t);
  const candidates = useMemo(
    () => compatibleItems(snapshot, slot, catalog),
    [snapshot, slot, catalog],
  );
  const options = useMemo(
    () => ({
      phases: [...new Set(candidates.map((i) => i.phase))].sort(
        (a, b) => a - b,
      ),
      sources: [
        ...new Map(
          candidates
            .flatMap((i) => localizedItemSources(i, catalog, t))
            .map((s) => [s.key, s]),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label)),
      types: [
        ...new Map(
          candidates.map((i) => {
            const type = itemType(i);
            return [type.key, type] as const;
          }),
        ).values(),
      ].filter((t) => t.key !== "armor:0"),
    }),
    [candidates, catalog, t],
  );
  const [filters, setFilters] = useState<ItemFilters>({ ...emptyItemFilters });
  const [selected, setSelected] = useState(new Set<number>());
  const [limit, setLimit] = useState(60);
  const [error, setError] = useState<unknown>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toasts = useToastManager();
  const items = useMemo(
    () => filterItems(candidates, filters, spec.module),
    [candidates, filters, spec.module],
  );
  const owned = useMemo(
    () => new Map(snapshot.inventory.map((i) => [i.itemId, i])),
    [snapshot.inventory],
  );
  const capacity =
    maxCustomItems -
    snapshot.inventory.filter((i) => i.source === "custom").length;
  const changeFilters = (next: ItemFilters) => {
    setFilters(next);
    setLimit(60);
  };
  const reset = () => changeFilters({ ...emptyItemFilters });
  function toggle(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < capacity) next.add(id);
      return next;
    });
  }
  function add() {
    try {
      const next = addCustomItems(request, slot, [...selected]);
      onChange(next);
      toasts.add({
        title: <AddedItemsToast count={selected.size} />,
        description: <AddedItemsDescription />,
        type: "success",
      });
      onClose();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <DialogContent
      className="custom-picker w-full rounded-none max-w-[70rem] overflow-hidden p-0 sm:p-0 max-h-dvh sm:w-[calc(100%-32px)] sm:rounded-panel sm:max-h-[calc(100dvh-32px)]"
      initialFocus={searchRef}
    >
      <div className="custom-picker-header">
        <div>
          <DialogTitle className="custom-picker-title">
            {t("picker.title")}
          </DialogTitle>
          <DialogDescription className="custom-picker-context">
            <PickerIcon name="lock" size={14} />
            <span>
              {slotName} · {spec.className} ·{" "}
              {itemVersions[itemVersionOf(snapshot)].label}
            </span>
          </DialogDescription>
        </div>
        <DialogDismiss />
      </div>
      <PickerFilters
        filters={filters}
        {...options}
        weapon={slot === "mainHand" || slot === "offHand" || slot === "ranged"}
        searchRef={searchRef}
        onChange={changeFilters}
        onReset={reset}
      />
      <div className="custom-picker-results-bar">
        <span aria-live="polite">
          {t("picker.compatible", { count: items.length, slot: slotName })}
        </span>
        <Select
          aria-label={t("picker.sort")}
          value={filters.sort}
          onValueChange={(sort) => changeFilters({ ...filters, sort })}
        >
          <SelectOption
            value="relevance"
            description={t("picker.relevanceHelp")}
          >
            {t("picker.relevance")}
          </SelectOption>
          <SelectOption value="level-desc">
            {t("picker.levelDesc")}
          </SelectOption>
          <SelectOption value="level-asc">{t("picker.levelAsc")}</SelectOption>
          <SelectOption value="name">{t("picker.nameSort")}</SelectOption>
        </Select>
      </div>
      <PickerResults
        items={items}
        catalog={catalog}
        owned={owned}
        selected={selected}
        stats={pickerStats(spec.module, t)}
        slotName={slotName}
        limit={limit}
        atCapacity={selected.size >= capacity}
        onToggle={toggle}
        onMore={() => setLimit(limit + 60)}
        onReset={reset}
        onClearSearch={() => changeFilters({ ...filters, search: "" })}
      />
      <div className="custom-picker-footer">
        <div className="custom-picker-selection">
          <strong aria-live="polite">
            {t("selectedCount", { count: selected.size })}
          </strong>
          <span>
            {selected.size >= capacity
              ? t("picker.capacity", { count: maxCustomItems })
              : !items.length && selected.size
                ? t("picker.kept")
                : t("picker.enhancements")}
          </span>
          {error != null && (
            <span role="alert" className="text-danger">
              {localizeDiagnostic(error, d)}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          className="custom-picker-clear text-muted p-0 font-normal"
          disabled={!selected.size}
          onClick={() => setSelected(new Set())}
        >
          {t("picker.clearSelection")}
        </Button>
        <Button
          className="custom-picker-add"
          disabled={!selected.size}
          onClick={add}
        >
          {selected.size
            ? t("picker.addCount", { count: selected.size })
            : t("picker.addItems")}
          <PickerIcon name="plus" />
        </Button>
      </div>
    </DialogContent>
  );
}

function AddedItemsToast({ count }: { count: number }) {
  const t = useTranslations("inventory");
  return t("picker.addedToast", { count });
}
function AddedItemsDescription() {
  const t = useTranslations("inventory");
  return t("picker.addedDescription");
}

import {
  ArmorType,
  WeaponType,
  RangedWeaponType,
} from "@/generated/wotlk/common";
import { useTranslations, useLocale } from "next-intl";
import { useId, useState, type RefObject } from "react";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { ItemFilters } from "@/domain/equipment/custom-items";
import { PickerIcon } from "./PickerIcon";
type Option = { key: string; label: string };
export function PickerFilters({
  filters,
  phases,
  sources,
  types,
  weapon,
  searchRef,
  onChange,
  onReset,
}: {
  filters: ItemFilters;
  phases: number[];
  sources: Option[];
  types: Option[];
  weapon: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onChange: (filters: ItemFilters) => void;
  onReset: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();

  function typeLabel(key: string) {
    const [group, id] = key.split(":");
    const names =
      group === "weapon"
        ? WeaponType
        : group === "ranged"
          ? RangedWeaponType
          : ArmorType;
    const prefix =
      group === "weapon"
        ? "WeaponType"
        : group === "ranged"
          ? "RangedWeaponType"
          : "ArmorType";
    const name = names[Number(id)]?.slice(prefix.length) ?? "Unknown";
    return t(`picker.types.${group}.${name}`);
  }
  const [more, setMore] = useState(false);
  const moreId = useId();
  const change = (key: keyof ItemFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  const count =
    Number(filters.source !== "all") + Number(filters.type !== "all");
  return (
    <div className="custom-picker-filters">
      <div className="custom-picker-search">
        <PickerIcon name="search" />
        <input
          ref={searchRef}
          type="search"
          aria-label={t("picker.search")}
          placeholder={t("picker.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => change("search", e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="custom-picker-filter-grid">
        <label>
          {t("picker.phaseLabel")}
          <Select
            aria-label={t("picker.phaseLabel")}
            value={filters.phase}
            onValueChange={(v) => change("phase", v)}
          >
            <SelectOption value="all">{t("picker.allPhases")}</SelectOption>
            {phases.map((phase) => (
              <SelectOption key={phase} value={phase}>
                {phase ? t("picker.phase", { phase }) : t("picker.preRaid")}
              </SelectOption>
            ))}
          </Select>
        </label>
        <div className="custom-picker-levels">
          <span>{t("picker.levelRange")}</span>
          <div>
            <input
              aria-label={t("picker.minLevel")}
              type="number"
              min="0"
              max="999"
              placeholder={t("picker.min")}
              value={filters.minLevel}
              onChange={(e) => change("minLevel", e.target.value)}
            />
            <span>–</span>
            <input
              aria-label={t("picker.maxLevel")}
              type="number"
              min="0"
              max="999"
              placeholder={t("picker.max")}
              value={filters.maxLevel}
              onChange={(e) => change("maxLevel", e.target.value)}
            />
          </div>
        </div>
        <div id={moreId} className="custom-picker-more" data-open={more}>
          <label>
            {t("picker.source")}
            <Select
              aria-label={t("picker.source")}
              value={filters.source}
              onValueChange={(v) => change("source", v)}
            >
              <SelectOption value="all">{t("picker.allSources")}</SelectOption>
              {sources.map((source) => (
                <SelectOption key={source.key} value={source.key}>
                  {source.label}
                </SelectOption>
              ))}
            </Select>
          </label>
          {types.length > 1 && (
            <label>
              {weapon ? t("picker.weaponType") : t("filters.armor")}
              <Select
                aria-label={
                  weapon ? t("picker.weaponType") : t("filters.armor")
                }
                value={filters.type}
                onValueChange={(v) => change("type", v)}
              >
                <SelectOption value="all">{t("picker.allTypes")}</SelectOption>
                {types.map((type) => (
                  <SelectOption key={type.key} value={type.key}>
                    {typeLabel(type.key)}
                  </SelectOption>
                ))}
              </Select>
            </label>
          )}
        </div>
        <Button
          variant="ghost"
          className="custom-picker-more-toggle hidden max-[640px]:flex text-muted p-0 font-normal"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore(!more)}
        >
          {t("picker.moreFilters")}
          {count ? ` (${count.toLocaleString(locale)})` : ""} {more ? "−" : "+"}
        </Button>
        <Button
          variant="ghost"
          className="custom-picker-reset text-muted font-normal"
          onClick={onReset}
        >
          {t("picker.reset")}
        </Button>
      </div>
    </div>
  );
}

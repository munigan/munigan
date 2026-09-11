import { localizedItemSources } from "./item-source-labels";
import { ItemSourceIcon } from "@/components/items/ItemSourceIcon";
import { useTranslations, useLocale } from "next-intl";
import type { InventoryTranslation } from "../item-labels";
import { Stat } from "@/generated/wotlk/common";
import type { UIItem } from "@/generated/wotlk/ui";
import type { Catalog } from "@/domain/equipment/catalog";
import type { ItemInstance } from "@/domain/top-gear/model";
import { customInstance } from "@/domain/equipment/custom-items";
import { ItemIcon } from "../Item";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";

export function pickerStats(
  module: string,
  t: InventoryTranslation,
): Array<{ stat: Stat; label: string; title: string }> {
  if (
    [
      "balance_druid",
      "elemental_shaman",
      "mage",
      "shadow_priest",
      "smite_priest",
      "warlock",
    ].includes(module)
  )
    return [
      {
        stat: Stat.StatSpellPower,
        label: t("picker.statShort.spellPower"),
        title: t("picker.stats.spellPower"),
      },
      {
        stat: Stat.StatSpellHit,
        label: t("picker.statShort.hit"),
        title: t("picker.stats.spellHit"),
      },
      {
        stat: Stat.StatSpellCrit,
        label: t("picker.statShort.crit"),
        title: t("picker.stats.spellCrit"),
      },
      {
        stat: Stat.StatSpellHaste,
        label: t("picker.statShort.haste"),
        title: t("picker.stats.spellHaste"),
      },
    ];
  const agility = [
    "hunter",
    "rogue",
    "feral_druid",
    "enhancement_shaman",
  ].includes(module);
  return [
    {
      stat: agility ? Stat.StatAgility : Stat.StatStrength,
      label: agility
        ? t("picker.statShort.agility")
        : t("picker.statShort.strength"),
      title: agility ? t("picker.stats.agility") : t("picker.stats.strength"),
    },
    {
      stat: Stat.StatMeleeHit,
      label: t("picker.statShort.hit"),
      title: t("picker.stats.meleeHit"),
    },
    module === "hunter"
      ? {
          stat: Stat.StatMeleeCrit,
          label: t("picker.statShort.crit"),
          title: t("picker.stats.crit"),
        }
      : {
          stat: Stat.StatExpertise,
          label: t("picker.statShort.expertise"),
          title: t("picker.stats.expertise"),
        },
    {
      stat: Stat.StatArmorPenetration,
      label: t("picker.statShort.armorPenetration"),
      title: t("picker.stats.armorPenetration"),
    },
  ];
}
function PickerRow({
  item,
  catalog,
  owned,
  checked,
  disabled,
  stats,
  onToggle,
}: {
  item: UIItem;
  catalog: Catalog;
  owned?: ItemInstance;
  checked: boolean;
  disabled: boolean;
  stats: ReturnType<typeof pickerStats>;
  onToggle: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const sources = localizedItemSources(item, catalog, t);
  const source = sources[0];
  const details = [
    item.phase ? t("picker.phase", { phase: item.phase }) : null,
    source?.label,
    source?.detail || (item.heroic ? t("picker.heroic") : null),
  ]
    .filter(Boolean)
    .join(" · ");
  const quality =
    ["#a5a8af", "#f3f4f6", "#78e34d", "#71b5ee", "#d3aaef", "#f3b36b"][
      item.quality
    ] ?? "#f3f4f6";
  return (
    <label
      className="custom-picker-row"
      data-item-id={item.id}
      data-selected={checked}
      data-owned={!!owned}
    >
      <input
        type="checkbox"
        aria-label={t("picker.select", { name: item.name, id: item.id })}
        disabled={!!owned || disabled}
        checked={!!owned || checked}
        onChange={onToggle}
      />
      <ItemIcon item={owned ?? customInstance(item.id)} tooltipOnly size={44} />
      <span className="custom-picker-item-text">
        <span className="custom-picker-item-name" style={{ color: quality }}>
          {item.name}
          {owned && (
            <ItemSourceIcon
              source={owned.source}
              label={owned.source === "custom" ? t("picker.added") : undefined}
            />
          )}
        </span>
        <span className="custom-picker-item-description">
          <span className="custom-picker-mobile-level">
            iLvl {item.ilvl} ·{" "}
          </span>
          {details || t("picker.noSource")}
        </span>
      </span>
      <span className="custom-picker-ilvl">{item.ilvl}</span>
      <span className="custom-picker-stat-values">
        {stats.map(({ stat, label, title }) => (
          <span key={stat} title={title}>
            {Math.round(item.stats[stat] ?? 0)?.toLocaleString(locale) === "0"
              ? "—"
              : Math.round(item.stats[stat] ?? 0).toLocaleString(locale)}
            <span className="custom-picker-mobile-stat-label"> {label}</span>
          </span>
        ))}
      </span>
    </label>
  );
}
export function PickerResults({
  items,
  catalog,
  owned,
  selected,
  stats,
  slotName,
  limit,
  atCapacity,
  onToggle,
  onMore,
  onReset,
  onClearSearch,
}: {
  items: UIItem[];
  catalog: Catalog;
  owned: Map<number, ItemInstance>;
  selected: Set<number>;
  stats: ReturnType<typeof pickerStats>;
  slotName: string;
  limit: number;
  atCapacity: boolean;
  onToggle: (id: number) => void;
  onMore: () => void;
  onReset: () => void;
  onClearSearch: () => void;
}) {
  const t = useTranslations("inventory");
  return (
    <div className="custom-picker-results">
      <div className="custom-picker-columns" aria-hidden="true">
        <span>{t("picker.item")}</span>
        <span>iLvl</span>
        {stats.map((s) => (
          <span key={s.stat} title={s.title}>
            {s.label}
          </span>
        ))}
      </div>
      {items.length ? (
        <>
          {items.slice(0, limit).map((item) => (
            <PickerRow
              key={item.id}
              item={item}
              catalog={catalog}
              owned={owned.get(item.id)}
              checked={selected.has(item.id)}
              disabled={atCapacity && !selected.has(item.id)}
              stats={stats}
              onToggle={() => onToggle(item.id)}
            />
          ))}
          {items.length > limit && (
            <Pagination
              variant="load-more"
              hasNext
              onLoadMore={onMore}
              range={{
                start: 1,
                end: Math.min(limit, items.length),
                total: items.length,
              }}
            />
          )}
        </>
      ) : (
        <div className="custom-picker-empty">
          <strong>{t("picker.empty", { slot: slotName })}</strong>
          <p>{t("picker.emptyHelp", { slot: slotName })}</p>
          <div>
            <Button variant="secondary" onClick={onClearSearch}>
              {t("picker.clearSearch")}
            </Button>
            <Button variant="ghost" onClick={onReset}>
              {t("picker.reset")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

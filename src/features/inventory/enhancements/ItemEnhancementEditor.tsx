"use client";
import { colorParts, matchesSocket } from "@/domain/equipment/sockets";
import { ItemSourceIcon } from "@/components/items/ItemSourceIcon";

import { useId, useMemo, useRef, useState, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@base-ui/react/checkbox";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select, SelectOption } from "@/components/ui/Select";
import type {
  Diagnostic,
  ItemEnhancementOverride,
  ItemInstance,
  TopGearRequest,
} from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import { itemSockets } from "@/domain/equipment/sockets";
import { eligibleSlots } from "@/domain/equipment/validate";
import { compareSpecItems } from "@/domain/equipment/item-relevance";
import {
  previewItemEnhancements,
  validateItemEnhancements,
} from "@/domain/equipment/item-enhancements";
import { GemColor, ItemType } from "@/generated/wotlk/common";
import { UIItem } from "@/generated/wotlk/ui";
import { getSpec } from "@/features/settings/registry";
import { ItemImage } from "../Item";
import { ItemVersionContext } from "../ItemVersionContext";
import { gemDescription } from "../gem-labels";
import { statLines } from "../stat-labels";
import type { InventoryTranslation } from "../item-labels";
import { enhancementDiagnosticText } from "./enhancement-labels";
import { automaticFieldOverride } from "./automatic-field";
import { itemEnchantOptions } from "./enchant-options";
import { EnchantImage } from "./EnchantImage";
import { enchantDescription } from "./enchant-description";
import "./enhancements.css";

type Field = number | "enchant";
type Props = {
  request: Pick<TopGearRequest, "snapshot">;
  item: ItemInstance;
  initialField: Field;
  onApply: (value: ItemEnhancementOverride) => void;
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
};
type Choice = {
  id: number;
  name: string;
  description: string;
  stats: number[];
  color?: GemColor;
  issues: Diagnostic[];
};

function colorName(color: GemColor, t: InventoryTranslation) {
  return t(
    `editor.colors.${GemColor[color]?.replace("GemColor", "") || "Prismatic"}`,
  );
}
function fieldName(
  field: Field,
  colors: GemColor[],
  t: InventoryTranslation,
  metadata?: UIItem,
) {
  return field === "enchant"
    ? t("editor.enchant")
    : t("editor.socket", {
        index: field + 1,
        color:
          metadata && field >= metadata.gemSockets.length
            ? t(
                metadata.type === ItemType.ItemTypeWaist
                  ? "editor.beltBuckle"
                  : "item.blacksmithSocket",
              )
            : colorName(colors[field] ?? GemColor.GemColorPrismatic, t),
      });
}

export function EnhancementGlyph({
  kind = "enchant",
  size = 32,
}: {
  kind?: "enchant" | "auto" | "empty";
  size?: number;
}) {
  return (
    <span className="enhancement-glyph" style={{ width: size, height: size }}>
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {kind === "enchant" ? (
          <>
            <path d="m5 19 11-11 3 3L8 22zM4 3v4M2 5h4M17 1v4M15 3h4M20 16v4M18 18h4" />
            <path d="m13 11 3 3" />
          </>
        ) : kind === "empty" ? (
          <>
            <path d="m12 3 9 9-9 9-9-9z" />
            <path d="M8 12h8" />
          </>
        ) : (
          <>
            <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
            <path d="M19 2v4M17 4h4" />
          </>
        )}
      </svg>
    </span>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="enhancement-check-label" htmlFor={id}>
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="enhancement-checkbox"
      >
        <Checkbox.Indicator className="enhancement-checkmark">
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m4 10 4 4 8-8" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span>{label}</span>
    </label>
  );
}

export function ItemEnhancementEditor({
  request,
  item,
  initialField,
  onApply,
  onClose,
  returnFocus,
}: Props) {
  const t = useTranslations("inventory"),
    locale = useLocale();
  const { snapshot } = request;
  const catalog = getCatalog(snapshot.itemVersion),
    metadata = catalog.items.get(item.itemId);
  const [pending, setPending] = useState<ItemEnhancementOverride>(() =>
    structuredClone(snapshot.itemEnhancements?.[item.instanceId] ?? {}),
  );
  const enchants = metadata ? itemEnchantOptions(snapshot, metadata) : [];
  const hasEnchants = enchants.length > 0;
  const [field, setField] = useState<Field>(
    initialField === "enchant" && !hasEnchants ? 0 : initialField,
  );
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("all"),
    [sort, setSort] = useState("spec");
  const [matchColor, setMatchColor] = useState(false),
    [showUnavailable, setShowUnavailable] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [initiator] = useState(() =>
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null,
  );
  const localSnapshot = useMemo(
    () => ({
      ...snapshot,
      itemEnhancements: {
        ...snapshot.itemEnhancements,
        [item.instanceId]: pending,
      },
    }),
    [snapshot, item.instanceId, pending],
  );
  const preview = useMemo(
    () => previewItemEnhancements(localSnapshot, item),
    [localSnapshot, item],
  );
  const automaticSnapshot = useMemo(
    () => ({
      ...snapshot,
      itemEnhancements: {
        ...snapshot.itemEnhancements,
        [item.instanceId]: automaticFieldOverride(pending, field),
      },
    }),
    [snapshot, item.instanceId, pending, field],
  );
  const automatic = useMemo(
    () => previewItemEnhancements(automaticSnapshot, item),
    [automaticSnapshot, item],
  );
  const colors = metadata ? itemSockets(snapshot, metadata) : [];
  const fields: Field[] = [
    ...Array.from(
      {
        length: Math.max(
          colors.length,
          pending.gemIds?.length ?? 0,
          item.gemIds.length,
        ),
      },
      (_, i) => i,
    ),
    ...(hasEnchants ? ["enchant" as const] : []),
  ];
  const value =
    field === "enchant" ? pending.enchantId : pending.gemIds?.[field];
  const resolvedId =
    field === "enchant" ? automatic.enchantId : automatic.gemIds[field];
  const diagnostics = validateItemEnhancements(snapshot, item, pending);
  const blocked = diagnostics.some((issue) => issue.severity === "error");
  const specModule = getSpec(snapshot.specId).module;
  const socketColor =
    typeof field === "number"
      ? (colors[field] ?? GemColor.GemColorPrismatic)
      : GemColor.GemColorUnknown;
  const activeBonus =
    !!metadata?.gemSockets.length &&
    metadata.gemSockets.every((socket, index) =>
      matchesSocket(catalog.gems.get(preview.gemIds[index])?.color, socket),
    );
  const bonus = metadata
    ? statLines(metadata.socketBonus, t, locale).join(" · ")
    : "";
  const currentName = (at: Field, resolved: ItemInstance) => {
    const id = at === "enchant" ? resolved.enchantId : resolved.gemIds[at];
    return id
      ? ((at === "enchant"
          ? catalog.enchants.get(id)?.[0]?.name
          : catalog.gems.get(id)?.name) ??
          t(at === "enchant" ? "item.enchantId" : "item.gemId", { id }))
      : t(at === "enchant" ? "editor.noEnchant" : "editor.emptySocket");
  };
  function issueText(issue: Diagnostic) {
    return enhancementDiagnosticText(issue, t);
  }
  const choices = ((): Choice[] => {
    if (!metadata) return [];
    const candidates: Choice[] =
      field === "enchant"
        ? enchants.flatMap((enchant) => {
            return enchant
              ? [
                  {
                    id: enchant.effectId,
                    name: enchant.name,
                    description: enchantDescription(enchant, t, locale),
                    stats: enchant.stats,
                    issues: validateItemEnhancements(snapshot, item, {
                      enchantId: enchant.effectId,
                    }),
                  },
                ]
              : [];
          })
        : [...catalog.gems.values()]
            .filter(
              (gem) =>
                (gem.color === GemColor.GemColorMeta) ===
                (socketColor === GemColor.GemColorMeta),
            )
            .map((gem) => ({
              id: gem.id,
              name: gem.name,
              description: gemDescription(gem, t, locale),
              stats: gem.stats,
              color: gem.color,
              issues: validateItemEnhancements(snapshot, item, {
                gemIds: Array.from({ length: field + 1 }, (_, index) =>
                  index === field ? gem.id : null,
                ),
              }),
            }));
    const query = search.trim().toLocaleLowerCase(locale);
    return candidates
      .filter((choice) => {
        if (
          !showUnavailable &&
          choice.issues.some((issue) => issue.severity === "error") &&
          choice.id !== value
        )
          return false;
        if (
          typeof field === "number" &&
          ((color !== "all" && choice.color !== Number(color)) ||
            (matchColor && !matchesSocket(choice.color, socketColor)))
        )
          return false;
        return (
          !query ||
          `${choice.id} ${choice.name} ${choice.description}`
            .toLocaleLowerCase(locale)
            .includes(query)
        );
      })
      .sort(
        (a, b) =>
          (sort === "spec"
            ? compareSpecItems(
                UIItem.create({ stats: a.stats }),
                UIItem.create({ stats: b.stats }),
                specModule,
              )
            : 0) || a.name.localeCompare(b.name, locale),
      );
  })();
  function choose(next: number | null) {
    setPending((previous) => {
      if (field === "enchant") {
        const updated = { ...previous };
        if (next === null) delete updated.enchantId;
        else updated.enchantId = next;
        return updated;
      }
      const gemIds = [...(previous.gemIds ?? [])];
      while (gemIds.length <= field) gemIds.push(null);
      gemIds[field] = next;
      return { ...previous, gemIds };
    });
  }
  function changeField(next: Field) {
    setField(next);
    setSearch("");
    setColor("all");
  }
  function renderChoice(
    id: number | null,
    name: string,
    description: string,
    issues: Diagnostic[] = [],
  ) {
    const selected = id === null ? value == null : value === id;
    const disabled = issues.some((issue) => issue.severity === "error");
    const issueId = `${item.instanceId}-${field}-${id ?? "auto"}-requirement`;
    return (
      <label
        key={id ?? "auto"}
        className="enhancement-choice"
        data-selected={selected || undefined}
        data-disabled={disabled || undefined}
      >
        {field === "enchant" && id !== 0 ? (
          <EnchantImage
            enchant={enchants.find((e) => e.effectId === (id ?? resolvedId))}
            size={36}
          />
        ) : id && field !== "enchant" ? (
          <ItemImage itemId={id} size={36} />
        ) : id === null && resolvedId && field !== "enchant" ? (
          <ItemImage itemId={resolvedId} size={36} />
        ) : (
          <EnhancementGlyph
            size={36}
            kind={id === null ? "auto" : id === 0 ? "empty" : "enchant"}
          />
        )}
        <span className="enhancement-choice-copy">
          <strong>{name}</strong>
          <span>{description}</span>
          {issues.length > 0 && (
            <span className="enhancement-requirement" id={issueId}>
              {issues.map(issueText).join(" · ")}
            </span>
          )}
        </span>
        <input
          type="radio"
          name={`enhancement-${field}`}
          aria-label={name}
          aria-describedby={issues.length ? issueId : undefined}
          checked={selected}
          disabled={disabled}
          onChange={() => choose(id)}
        />
      </label>
    );
  }
  return (
    <ItemVersionContext value={snapshot.itemVersion ?? "classic"}>
      <DialogRoot
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="item-enhancement-editor enhancement-editor w-full rounded-none max-w-[70rem] overflow-hidden p-0 sm:p-0 max-h-dvh sm:w-[calc(100%-32px)] sm:rounded-panel sm:max-h-[calc(100dvh-32px)]"
          initialFocus={searchRef}
          finalFocus={returnFocus ?? (() => initiator)}
        >
          <header className="enhancement-header">
            <ItemImage itemId={item.itemId} size={48} />
            <div className="enhancement-heading">
              <DialogTitle className="enhancement-title">
                {t(hasEnchants ? "editor.title" : "editor.gemsTitle")}
              </DialogTitle>
              <DialogDescription className="enhancement-context">
                <strong>
                  {metadata?.name ?? t("item.unknown", { id: item.itemId })}
                </strong>
                <span>
                  {metadata && eligibleSlots(metadata)[0]
                    ? t(`slots.${eligibleSlots(metadata)[0]}`)
                    : ""}{" "}
                  · {t("editor.itemLevel", { level: metadata?.ilvl ?? 0 })} ·{" "}
                  <ItemSourceIcon source={item.source} />
                </span>
              </DialogDescription>
            </div>
            <DialogDismiss />
          </header>
          <div className="enhancement-body">
            <aside className="enhancement-sidebar">
              <div className="enhancement-nav" aria-label={t("editor.fields")}>
                {fields.map((at) => {
                  const manual =
                    at === "enchant"
                      ? pending.enchantId != null
                      : pending.gemIds?.[at] != null;
                  const id =
                    at === "enchant" ? preview.enchantId : preview.gemIds[at];
                  return (
                    <button
                      type="button"
                      key={at}
                      aria-label={fieldName(at, colors, t, metadata)}
                      aria-pressed={field === at}
                      data-enhancement-field={at}
                      className="enhancement-field"
                      onClick={() => changeField(at)}
                    >
                      {at === "enchant" ? (
                        <EnchantImage
                          enchant={enchants.find((e) => e.effectId === id)}
                        />
                      ) : id ? (
                        <ItemImage itemId={id} size={32} />
                      ) : (
                        <EnhancementGlyph kind="empty" />
                      )}
                      <span>
                        <strong>{fieldName(at, colors, t, metadata)}</strong>
                        <small>
                          {manual ? t("editor.manual") : t("editor.automatic")}{" "}
                          · {currentName(at, preview)}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="enhancement-auto-help">
                {t("editor.automaticHelp")}
              </p>
              {bonus && (
                <div
                  className="enhancement-bonus"
                  data-active={activeBonus || undefined}
                >
                  <strong>{t("item.socketBonus", { stats: bonus })}</strong>
                  <span>
                    {activeBonus
                      ? t("editor.bonusActive")
                      : t("editor.bonusInactive")}
                  </span>
                </div>
              )}
            </aside>
            <section className="enhancement-main">
              <div className="enhancement-controls">
                <h2>{fieldName(field, colors, t, metadata)}</h2>
                <p>
                  {field === "enchant"
                    ? t("editor.enchantHelp")
                    : t("editor.socketHelp")}
                </p>
                <div className="enhancement-toolbar">
                  <div className="enhancement-search">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <circle cx="10" cy="10" r="6" />
                      <path d="m15 15 5 5" />
                    </svg>
                    <input
                      ref={searchRef}
                      type="search"
                      aria-label={t(
                        field === "enchant"
                          ? "editor.searchEnchants"
                          : "editor.searchGems",
                      )}
                      placeholder={t("editor.searchPlaceholder")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="enhancement-filter-row enhancement-select-filters">
                    {field !== "enchant" &&
                      socketColor !== GemColor.GemColorMeta && (
                        <Select
                          aria-label={t("editor.colorFilter")}
                          value={color}
                          onValueChange={setColor}
                        >
                          <SelectOption value="all">
                            {t("editor.allColors")}
                          </SelectOption>
                          {Object.keys(colorParts).map((key) => (
                            <SelectOption key={key} value={key}>
                              {colorName(Number(key), t)}
                            </SelectOption>
                          ))}
                        </Select>
                      )}
                    <Select
                      aria-label={t("editor.sort")}
                      value={sort}
                      onValueChange={setSort}
                    >
                      <SelectOption
                        value="spec"
                        description={t("editor.specHelp")}
                      >
                        {t("editor.forSpec")}
                      </SelectOption>
                      <SelectOption value="name">
                        {t("picker.nameSort")}
                      </SelectOption>
                    </Select>
                  </div>
                </div>
                <div className="enhancement-filter-row">
                  {field !== "enchant" &&
                    socketColor !== GemColor.GemColorMeta && (
                      <FilterCheckbox
                        label={t("editor.matchColor")}
                        checked={matchColor}
                        onChange={setMatchColor}
                      />
                    )}
                  <FilterCheckbox
                    label={t("editor.showUnavailable")}
                    checked={showUnavailable}
                    onChange={setShowUnavailable}
                  />
                </div>
              </div>
              <div
                className="enhancement-results"
                role="radiogroup"
                aria-label={t(
                  field === "enchant"
                    ? "editor.enchantChoices"
                    : "editor.gemChoices",
                )}
              >
                {renderChoice(
                  null,
                  t("editor.automatic"),
                  `${currentName(field, automatic)} · ${t("editor.previewHelp")}`,
                )}
                {renderChoice(
                  0,
                  t(
                    field === "enchant"
                      ? "editor.noEnchant"
                      : "editor.emptySocket",
                  ),
                  t("editor.emptyHelp"),
                )}
                {choices.map((choice) =>
                  renderChoice(
                    choice.id,
                    choice.name,
                    choice.description,
                    choice.issues,
                  ),
                )}
                {!choices.length && (
                  <div className="enhancement-empty">
                    <strong>
                      {t(
                        field === "enchant"
                          ? "editor.noEnchants"
                          : "editor.noGems",
                      )}
                    </strong>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearch("");
                        setColor("all");
                        setMatchColor(false);
                      }}
                    >
                      {t("editor.clearSearch")}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </div>
          <footer className="enhancement-footer">
            <div className="enhancement-footer-copy">
              <span>{t("editor.localHelp")}</span>
              {diagnostics.length > 0 && (
                <p role={blocked ? "alert" : "status"}>
                  {diagnostics.map(issueText).join(" · ")}
                </p>
              )}
            </div>
            <Button
              className="enhancement-reset"
              variant="ghost"
              onClick={() => setPending({})}
            >
              {t("editor.resetItem")}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t("editor.cancel")}
            </Button>
            <Button
              disabled={blocked}
              onClick={() => {
                onApply(pending);
                onClose();
              }}
            >
              {t("editor.apply")}
            </Button>
          </footer>
        </DialogContent>
      </DialogRoot>
    </ItemVersionContext>
  );
}

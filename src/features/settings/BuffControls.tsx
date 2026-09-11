"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { JsonObject } from "@protobuf-ts/runtime";
import {
  RaidBuffs,
  PartyBuffs,
  IndividualBuffs,
  Debuffs,
} from "@/generated/wotlk/common";
import type { Snapshot } from "@/domain/top-gear/model";
import { Select, SelectOption } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { SettingIcon } from "./SettingIcon";
import { SettingsIcon } from "./SettingsIcon";
import { SettingsSegments } from "./SettingsSegments";
import { buffLabel } from "./setting-labels";
import metadata from "../../../data/wotlk/settings-ui.json";
const meta = metadata.buffs as Record<
  string,
  { icon?: string; kind?: string; max?: number; step?: number }
>;
const groups = [
  { key: "raidBuffs", type: RaidBuffs, category: "raid" },
  { key: "buffs", type: IndividualBuffs, category: "personal" },
  { key: "partyBuffs", type: PartyBuffs, category: "personal" },
  { key: "debuffs", type: Debuffs, category: "target" },
] as const;
const effectKeys: Record<string, string> = {
  battleShout: "attackPower",
  blessingOfMight: "attackPower",
  giftOfTheWild: "attributes",
  windfuryTotem: "meleeHaste",
  icyTalons: "meleeHaste",
  bloodlust: "temporaryHaste",
  totemOfWrath: "spellPower",
  demonicPactSp: "spellPower",
  flametongueTotem: "spellPower",
  sunderArmor: "armor",
  exposeArmor: "armor",
  faerieFire: "armorHit",
  misery: "spellHit",
  curseOfElements: "magicDamage",
  powerInfusions: "priests",
  tricksOfTheTrades: "rogues",
  heroicPresence: "partyHit",
  innervates: "druids",
  manaTideTotems: "shamans",
};
const priority = [
  "battleShout",
  "giftOfTheWild",
  "windfuryTotem",
  "bloodlust",
  "totemOfWrath",
  "demonicPactSp",
  "powerInfusions",
  "tricksOfTheTrades",
  "sunderArmor",
  "faerieFire",
  "misery",
];
export function BuffControls({
  snapshot,
  onPatch,
  onClear,
}: {
  snapshot: Snapshot;
  onPatch: (p: JsonObject) => void;
  onClear?: () => void;
}) {
  const t = useTranslations("settings");
  const [search, setSearch] = useState(""),
    [activeOnly, setActiveOnly] = useState(false),
    [category, setCategory] = useState("raid"),
    [confirm, setConfirm] = useState(false);
  const visible = groups
    .filter((g) => search.trim() || g.category === category)
    .map((g) => {
      const values = (g.key === "buffs"
        ? snapshot.settings.player?.buffs
        : snapshot.settings[g.key]) as unknown as
        Record<string, number | boolean> | undefined;
      const fields = g.type.fields
        .filter(
          (f) =>
            (!activeOnly || Boolean(values?.[f.localName])) &&
            `${buffLabel(g.key, f.localName, t)} ${f.localName} ${effectKeys[f.localName] ? t(`buffs.effects.${effectKeys[f.localName]}`) : ""}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => {
          const rank = (s: string) =>
            priority.includes(s) ? priority.indexOf(s) : 999;
          return rank(a.localName) - rank(b.localName);
        });
      return { ...g, values, fields };
    });
  return (
    <div className="visual-buffs">
      <div className="settings-filter">
        <div className="settings-search">
          <SettingsIcon name="search" />
          <input
            type="search"
            aria-label={t("buffs.find")}
            placeholder={t("buffs.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          {t("buffs.activeOnly")}
        </label>
        {onClear && (
          <button
            type="button"
            className="settings-clear"
            onClick={() => setConfirm(true)}
          >
            {t("buffs.clear")}
          </button>
        )}
      </div>
      <SettingsSegments
        mobileSelect
        label={t("buffs.categories")}
        value={category}
        onChange={setCategory}
        options={[
          { value: "raid", label: t("buffs.groups.raidBuffs"), icon: "raid" },
          {
            value: "personal",
            label: t("buffs.personalParty"),
            icon: "personal",
          },
          {
            value: "target",
            label: t("buffs.groups.debuffs"),
            icon: "encounter",
          },
        ]}
      />
      {confirm && (
        <div className="settings-inline-confirm" role="alert">
          <p>{t("buffs.clearConfirm")}</p>
          <div>
            <button type="button" onClick={() => setConfirm(false)}>
              {t("keepEditing")}
            </button>
            <button
              type="button"
              onClick={() => {
                onClear?.();
                setConfirm(false);
              }}
            >
              {t("buffs.clear")}
            </button>
          </div>
        </div>
      )}
      {visible
        .filter((g) => g.fields.length)
        .map((g) => (
          <section key={g.key} className="settings-effect-section">
            <div className="settings-list-heading">
              <h4>{t(`buffs.groups.${g.key}`)}</h4>
              <span>
                {t("buffs.activeCount", {
                  count: Object.values(g.values ?? {}).filter(Boolean).length,
                })}
              </span>
            </div>
            <div className="buff-grid">
              {g.fields.map((f) => {
                const key = f.localName,
                  m = meta[`${g.key}.${key}`],
                  value = g.values?.[key] ?? 0,
                  label = buffLabel(g.key, key, t),
                  isBool = f.kind === "scalar" && f.T === 8;
                const set = (v: number | boolean) =>
                  onPatch(
                    g.key === "buffs"
                      ? { player: { buffs: { [key]: v } } }
                      : { [g.key]: { [key]: v } },
                  );
                const description = effectKeys[key]
                  ? t(`buffs.effects.${effectKeys[key]}`)
                  : t(`buffs.scope.${g.key}`);
                return (
                  <div
                    className="buff-control"
                    key={key}
                    data-active={Boolean(value)}
                  >
                    <SettingIcon key={m?.icon ?? key} icon={m?.icon} />
                    <div className="buff-copy">
                      <span className="buff-label">{label}</span>
                      <span className="buff-description">{description}</span>
                    </div>
                    <div className="buff-action">
                      {isBool ? (
                        <input
                          aria-label={label}
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) => set(e.target.checked)}
                        />
                      ) : f.kind === "enum" || m?.kind === "quad" ? (
                        <Select
                          size="small"
                          aria-label={label}
                          value={Number(value)}
                          onValueChange={(v) => set(Number(v))}
                        >
                          <SelectOption value={0}>
                            {t("buffs.off")}
                          </SelectOption>
                          <SelectOption value={1}>
                            {t("buffs.normal")}
                          </SelectOption>
                          <SelectOption value={2}>
                            {t("buffs.improved")}
                          </SelectOption>
                          {m?.kind === "quad" && (
                            <SelectOption value={3}>
                              {t("buffs.glyph")}
                            </SelectOption>
                          )}
                        </Select>
                      ) : (
                        <NumberInput
                          size="small"
                          label={label}
                          min={0}
                          max={m?.max}
                          step={1}
                          value={Number(value)}
                          onValueChange={set}
                          unit={
                            m?.kind === "percent" ||
                            key.startsWith("revitalize")
                              ? "%"
                              : g.category === "personal" &&
                                  !key.startsWith("revitalize")
                                ? t(
                                    Number(value) === 1
                                      ? "buffs.source"
                                      : "buffs.sources",
                                  )
                                : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      {!visible.some((g) => g.fields.length) && (
        <div className="settings-empty">
          <SettingsIcon name="search" size={24} />
          <p>{t("buffs.empty")}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSearch("");
              setActiveOnly(false);
            }}
          >
            {t("buffs.reset")}
          </button>
        </div>
      )}
    </div>
  );
}

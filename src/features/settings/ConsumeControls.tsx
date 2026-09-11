"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { JsonObject } from "@protobuf-ts/runtime";
import type { Snapshot } from "@/domain/top-gear/model";
import {
  Consumes,
  Conjured,
  Profession,
  Class,
} from "@/generated/wotlk/common";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { NumberInput } from "@/components/ui/NumberInput";
import { SettingIcon } from "./SettingIcon";
import { SettingsSegments } from "./SettingsSegments";
import { SettingsIcon } from "./SettingsIcon";
import { consumeFallbackNames } from "./setting-labels";
import metadata from "../../../data/wotlk/settings-ui.json";
const meta = metadata.consumes as Record<
  string,
  Record<string, { itemId: number; name: string; icon?: string }>
>;
export function ConsumeControls({
  snapshot,
  onPatch,
}: {
  snapshot: Snapshot;
  onPatch: (p: JsonObject) => void;
}) {
  const t = useTranslations("settings"),
    player = snapshot.settings.player!,
    consumes = player.consumes ?? Consumes.create();
  const [mode, setMode] = useState(
    consumes.battleElixir || consumes.guardianElixir ? "elixir" : "flask",
  );
  const set = (key: string, value: number | boolean) => {
    const patch: JsonObject = { [key]: value };
    if (key === "flask" && value) {
      patch.battleElixir = 0;
      patch.guardianElixir = 0;
    }
    if ((key === "battleElixir" || key === "guardianElixir") && value)
      patch.flask = 0;
    onPatch({ player: { consumes: patch } });
  };
  function field(key: string) {
    const f = Consumes.fields.find((f) => f.localName === key)!,
      value = (consumes as unknown as Record<string, number | boolean>)[key],
      enumeration = f.kind === "enum" ? f.T() : null;
    const entries = enumeration
      ? Object.entries(enumeration[1]).filter(
          ([, v]) =>
            typeof v === "number" &&
            (key !== "defaultConjured" ||
              v !== Conjured.ConjuredRogueThistleTea ||
              player.class === Class.ClassRogue ||
              v === value),
        )
      : [];
    const catalog = enumeration
      ? meta[enumeration[0].replace("proto.", "")]
      : null;
    const item = catalog?.[String(value)] ?? meta.boolean?.[key];
    const label = t(`consumes.labels.${key}`);
    if (f.kind === "scalar" && f.T === 8)
      return (
        <label className="consume-toggle" key={key}>
          <SettingIcon icon={item?.icon} />
          <span>{label}</span>
          <input
            type="checkbox"
            aria-label={label}
            checked={Boolean(value)}
            onChange={(e) => set(key, e.target.checked)}
          />
        </label>
      );
    if (!enumeration)
      return (
        <div className="consume-scroll-control" key={key}>
          <span>{t(`consumes.scrolls.${key}`)}</span>
          <NumberInput
            label={label}
            value={Number(value)}
            min={0}
            max={5}
            size="small"
            unit={t("consumes.rank")}
            onValueChange={(v) => set(key, v)}
          />
        </div>
      );
    return (
      <div className="consume-control" key={key}>
        <span>{label}</span>
        <SearchableSelect
          label={label}
          value={String(value)}
          triggerIcon={
            <SettingIcon key={item?.icon ?? key} icon={item?.icon} />
          }
          triggerDescription={t(`consumes.purpose.${key}`)}
          options={entries.map(([, v]) => ({
            value: String(v),
            label:
              v === 0
                ? t("none")
                : (catalog?.[String(v)]?.name ??
                  consumeFallbackNames[`${enumeration![0]}.${v}`] ??
                  t("consumes.unknown")),
            description: v === 0 ? undefined : t(`consumes.purpose.${key}`),
            icon: <SettingIcon icon={catalog?.[String(v)]?.icon} />,
          }))}
          onValueChange={(v) => set(key, Number(v))}
        />
      </div>
    );
  }
  const engineer = [player.profession1, player.profession2].includes(
      Profession.Engineering,
    ),
    pet = [
      Class.ClassHunter,
      Class.ClassWarlock,
      Class.ClassDeathknight,
    ].includes(player.class);
  return (
    <div className="visual-consumes">
      <SettingsSegments
        label={t("consumes.longBuff")}
        value={mode}
        onChange={setMode}
        options={[
          {
            value: "flask",
            label: t("consumes.labels.flask"),
            icon: "consumes",
          },
          { value: "elixir", label: t("consumes.elixirs"), icon: "elixirs" },
        ]}
      />
      <div className="consume-grid">
        {mode === "flask" ? (
          field("flask")
        ) : (
          <>
            {field("battleElixir")}
            {field("guardianElixir")}
          </>
        )}
        {field("food")}
      </div>
      <p className="settings-note">
        <SettingsIcon name="info" />
        {t("consumes.help")}
      </p>
      <section>
        <h4>{t("consumes.combat")}</h4>
        <div className="consume-grid">
          {["prepopPotion", "defaultPotion", "defaultConjured"].map(field)}
        </div>
      </section>
      {(engineer ||
        consumes.thermalSapper ||
        consumes.explosiveDecoy ||
        consumes.fillerExplosive > 0) && (
        <section>
          <h4>{t("consumes.engineering")}</h4>
          {!engineer && (
            <p className="settings-warning">{t("consumes.engineerRequired")}</p>
          )}
          <div className="consume-grid">
            {["thermalSapper", "explosiveDecoy", "fillerExplosive"].map(field)}
          </div>
        </section>
      )}
      {(pet ||
        consumes.petFood > 0 ||
        consumes.petScrollOfAgility > 0 ||
        consumes.petScrollOfStrength > 0) && (
        <section>
          <h4>{t("consumes.pet")}</h4>
          <div className="consume-grid consume-pet-grid">
            {["petFood", "petScrollOfAgility", "petScrollOfStrength"].map(
              field,
            )}
          </div>
          <p className="settings-note">{t("consumes.petHelp")}</p>
        </section>
      )}
    </div>
  );
}

import { useTranslations, useLocale } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { SettingsIcon } from "./SettingsIcon";
import type { Snapshot } from "@/domain/top-gear/model";
export function EncounterSettings({
  encounter,
  onPreset,
  onDurationChange,
  onVariationChange,
  onTargetsChange,
}: {
  encounter: NonNullable<Snapshot["settings"]["encounter"]>;
  onPreset: (targets: number, duration: number) => void;
  onDurationChange: (n: number) => void;
  onVariationChange: (n: number) => void;
  onTargetsChange: (n: number) => void;
}) {
  const t = useTranslations("settings"),
    locale = useLocale();
  const number = (n: number) => n.toLocaleString(locale);
  return (
    <>
      <div className="encounter-presets" aria-label={t("encounter.shortcuts")}>
        {(
          [
            { key: "single", count: 1, duration: 180, icon: "encounter" },
            { key: "cleave", count: 3, duration: 180, icon: "raid" },
            { key: "short", count: 1, duration: 60, icon: "clock" },
          ] as const
        ).map((o) => (
          <button
            type="button"
            key={o.key}
            aria-label={t(`encounter.${o.key}`)}
            aria-pressed={
              encounter.duration === o.duration &&
              encounter.targets.length === o.count
            }
            onClick={() => onPreset(o.count, o.duration)}
          >
            <span>
              <SettingsIcon name={o.icon} />
              <strong>{t(`encounter.presetNames.${o.key}`)}</strong>
            </span>
            <small>
              {t("encounter.presetSummary", {
                count: o.count,
                seconds: o.duration,
              })}
            </small>
          </button>
        ))}
      </div>
      <h4>{t("encounter.parameters")}</h4>
      <div className="form-grid">
        <div className="settings-field">
          <span>{t("encounter.duration")}</span>
          <NumberInput
            label={t("encounter.duration")}
            min={10}
            max={600}
            value={encounter.duration}
            unit={t("encounter.seconds")}
            onValueChange={onDurationChange}
          />
        </div>
        <div className="settings-field">
          <span>{t("encounter.variation")}</span>
          <NumberInput
            label={t("encounter.variation")}
            min={0}
            max={encounter.duration / 2}
            value={encounter.durationVariation}
            unit={t("encounter.seconds")}
            onValueChange={onVariationChange}
          />
        </div>
        <label className="settings-field">
          {t("encounter.targets")}
          <Select
            aria-label={t("encounter.targets")}
            value={encounter.targets.length}
            onValueChange={(v) => onTargetsChange(Number(v))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <SelectOption key={n} value={n}>
                {t("encounter.targetCount", { count: n })}
              </SelectOption>
            ))}
          </Select>
        </label>
      </div>
      <div className="settings-fight-window">
        <div>
          <span>{t("encounter.window")}</span>
          <strong>
            {t("encounter.windowValue", {
              min: number(encounter.duration - encounter.durationVariation),
              max: number(encounter.duration + encounter.durationVariation),
            })}
          </strong>
        </div>
        <div className="settings-window-line">
          <i />
          <b />
        </div>
        <div>
          <span>
            {number(encounter.duration - encounter.durationVariation)}s
          </span>
          <span className="positive">
            {t("encounter.average", { seconds: number(encounter.duration) })}
          </span>
          <span>
            {number(encounter.duration + encounter.durationVariation)}s
          </span>
        </div>
      </div>
      <div className="settings-note">
        <SettingsIcon name="info" />
        <div>
          <strong>{t("encounter.why")}</strong>
          <p>{t("encounter.whyHelp")}</p>
        </div>
      </div>
      <details className="settings-disclosure">
        <summary>{t("encounter.importedDetails")}</summary>
        <p>{t("encounter.preserved")}</p>
        <pre>{JSON.stringify(encounter.targets, null, 2)}</pre>
      </details>
    </>
  );
}

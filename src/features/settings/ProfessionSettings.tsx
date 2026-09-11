import { useTranslations } from "next-intl";
import type { Snapshot } from "@/domain/top-gear/model";
import type { JsonObject } from "@protobuf-ts/runtime";
import { Profession } from "@/generated/wotlk/common";
import { Select, SelectOption } from "@/components/ui/Select";
import { SettingIcon, professionIcons } from "./SettingIcon";
import { SettingsIcon } from "./SettingsIcon";
import { validateItemEnhancements } from "@/domain/equipment/item-enhancements";
import { enhancementDiagnosticText } from "@/features/inventory/enhancements/enhancement-labels";
import { getCatalog } from "@/domain/equipment/catalog";
export function ProfessionSettings({
  snapshot,
  onPatch,
  onChange,
}: {
  snapshot: Snapshot;
  onPatch: (p: JsonObject) => void;
  onChange: (s: Snapshot) => void;
}) {
  const t = useTranslations("settings"),
    i = useTranslations("inventory"),
    p = snapshot.settings.player!;
  const active = [p.profession1, p.profession2].filter(Boolean);
  const conflicts = snapshot.inventory.flatMap((item) => {
    const override = snapshot.itemEnhancements?.[item.instanceId];
    const issues = override
      ? validateItemEnhancements(snapshot, item, override)
      : [];
    return issues.length ? [{ item, issues }] : [];
  });
  const catalog = getCatalog(snapshot.itemVersion);
  return (
    <>
      <div className="form-grid profession-grid">
        {(["profession1", "profession2"] as const).map((field, index) => (
          <div className="settings-field" key={field}>
            <span>{t("profession.label", { number: index + 1 })}</span>
            <div className="profession-input">
              <SettingIcon icon={professionIcons[p[field]]} />
              <Select
                aria-label={t("profession.label", { number: index + 1 })}
                value={p[field]}
                onValueChange={(v) =>
                  onPatch({ player: { [field]: Number(v) } })
                }
              >
                {Object.entries(Profession)
                  .filter(([, v]) => typeof v === "number")
                  .map(([name, v]) => (
                    <SelectOption
                      key={name}
                      value={v}
                      disabled={
                        Boolean(v) &&
                        v ===
                          p[
                            field === "profession1"
                              ? "profession2"
                              : "profession1"
                          ]
                      }
                    >
                      {v === 0 ? t("none") : i(`editor.professions.${name}`)}
                    </SelectOption>
                  ))}
              </Select>
            </div>
            <small>
              {snapshot.professionLevels?.[p[field]] !== undefined
                ? t("profession.rank", {
                    rank: snapshot.professionLevels[p[field]],
                  })
                : p[field]
                  ? t("profession.rankUnknown")
                  : t("profession.choose")}
            </small>
          </div>
        ))}
      </div>
      <h4>{t("profession.benefitsTitle")}</h4>
      <div className="settings-detail-list">
        {active.map((profession) => (
          <div className="settings-detail-row" key={profession}>
            <SettingIcon icon={professionIcons[profession]} />
            <div>
              <strong>
                {i(`editor.professions.${Profession[profession]}`)}
              </strong>
              <p>{t(`profession.benefits.${Profession[profession]}`)}</p>
            </div>
            <SettingsIcon name="check" />
          </div>
        ))}
        {!active.length && (
          <p className="settings-note">{t("profession.choose")}</p>
        )}
      </div>
      {conflicts.length > 0 && (
        <section className="settings-conflicts">
          <h4>
            <SettingsIcon name="info" />
            {t("profession.conflicts", { count: conflicts.length })}
          </h4>
          <p>{t("profession.conflictHelp")}</p>
          <div className="settings-detail-list">
            {conflicts.map(({ item, issues }) => (
              <div className="settings-detail-row" key={item.instanceId}>
                <div>
                  <strong>{catalog.items.get(item.itemId)?.name}</strong>
                  {issues.map((issue) => (
                    <p key={issue.path}>
                      {enhancementDiagnosticText(issue, i)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const itemEnhancements = { ...snapshot.itemEnhancements };
              for (const { item } of conflicts)
                delete itemEnhancements[item.instanceId];
              onChange({ ...snapshot, itemEnhancements });
            }}
          >
            {t("profession.useAutomatic")}
          </button>
        </section>
      )}
      <p className="settings-note">
        <SettingsIcon name="info" />
        {t("profession.connection")}
      </p>
    </>
  );
}

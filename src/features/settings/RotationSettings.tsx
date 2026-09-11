import { useTranslations } from "next-intl";
import type { Snapshot } from "@/domain/top-gear/model";
import type { JsonObject } from "@protobuf-ts/runtime";
import { APLRotation, APLRotation_Type } from "@/generated/wotlk/apl";
import { Select, SelectOption } from "@/components/ui/Select";
import { SettingsIcon } from "./SettingsIcon";
import { SettingsSegments } from "./SettingsSegments";
import { getSpec, modules } from "./registry";
export function RotationSettings({
  snapshot,
  onPatch,
}: {
  snapshot: Snapshot;
  onPatch: (p: JsonObject) => void;
}) {
  const t = useTranslations("settings"),
    spec = getSpec(snapshot.specId),
    rotation = snapshot.settings.player?.rotation;
  const presets = Object.entries(modules[spec.module].presets).filter(
    ([, v]) => v.rotation?.rotation,
  );
  const auto = rotation?.type === APLRotation_Type.TypeAuto || !rotation;
  const current =
    presets.find(
      ([, v]) =>
        JSON.stringify(
          APLRotation.toJson(
            APLRotation.create(v.rotation!.rotation as APLRotation),
          ),
        ) ===
        JSON.stringify(APLRotation.toJson(rotation ?? APLRotation.create())),
    )?.[0] ?? "custom";
  function choose(value: string) {
    const r = presets.find(([k]) => k === value)?.[1].rotation?.rotation;
    if (value === "auto")
      onPatch({
        player: {
          rotation: APLRotation.toJson(
            APLRotation.create({ type: APLRotation_Type.TypeAuto }),
          ),
        },
      });
    else if (r)
      onPatch({
        player: {
          rotation: APLRotation.toJson(APLRotation.create(r as APLRotation)),
        },
      });
  }
  return (
    <>
      <SettingsSegments
        label={t("rotation.mode")}
        value={auto ? "auto" : "preset"}
        onChange={(v) => {
          if (v === "auto") choose("auto");
          else if (presets[0]) choose(presets[0][0]);
        }}
        options={[
          { value: "auto", label: t("rotation.automatic"), icon: "rotation" },
          { value: "preset", label: t("rotation.preset"), icon: "talents" },
        ]}
      />
      <div className="settings-rotation-current">
        <SettingsIcon name="rotation" size={28} />
        <div>
          <strong>
            {auto
              ? t("rotation.auto")
              : (presets.find(([k]) => k === current)?.[1].name ??
                t("rotation.imported"))}
          </strong>
          <p>{t("rotation.help")}</p>
        </div>
      </div>
      {!auto && (
        <label className="settings-field">
          {t("rotation.preset")}
          <Select
            aria-label={t("rotation.preset")}
            value={current}
            onValueChange={choose}
          >
            <SelectOption value="custom" disabled>
              {t("rotation.imported")}
            </SelectOption>
            {presets.map(([key, p]) => (
              <SelectOption key={key} value={key}>
                {p.name}
              </SelectOption>
            ))}
          </Select>
        </label>
      )}
      <div className="settings-detail-list">
        <div className="settings-detail-row">
          <SettingsIcon name="talents" />
          <div>
            <strong>{t("rotation.contextTitle")}</strong>
            <p>{t("rotation.context")}</p>
          </div>
        </div>
        <div className="settings-detail-row">
          <SettingsIcon name="encounter" />
          <div>
            <strong>{t("rotation.priorityTitle")}</strong>
            <p>
              {auto
                ? t("rotation.resolved")
                : t("rotation.actionCount", {
                    prepull:
                      rotation?.prepullActions.filter((a) => !a.hide).length ??
                      0,
                    combat:
                      rotation?.priorityList.filter((a) => !a.hide).length ?? 0,
                  })}
            </p>
          </div>
        </div>
      </div>
      {!auto && (
        <details className="settings-disclosure">
          <summary>{t("rotation.inspect")}</summary>
          <pre>{JSON.stringify(APLRotation.toJson(rotation!), null, 2)}</pre>
        </details>
      )}
    </>
  );
}

"use client";
import { useTranslations, useLocale } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import { estimateAllowance } from "@/domain/equipment/enumerate";
import {
  itemVersions,
  itemVersionOf,
  type ItemVersion,
} from "@/domain/top-gear/item-version";
import { getSpec } from "@/features/settings/registry";
import { EnhancementSummary } from "./GemmingPanel";
import { CharacterPortrait } from "./CharacterPortrait";
import { RunSettingRow, RunSettingAction } from "./RunSettingRow";
import { RunAllowance } from "./RunAllowance";
import { Button } from "@/components/ui/Button";
export function RunSetup({
  request,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  onChange: change,
  onImport,
  onSettings,
  onEnhancements,
  onRun,
  onReduceSelection,
}: {
  request: TopGearRequest;
  policy: WorkPolicy | null;
  allowance: ReturnType<typeof estimateAllowance> | null;
  error: string;
  readinessError: string;
  pending: boolean;
  onChange: (request: TopGearRequest) => void;
  onImport: () => void;
  onSettings: () => void;
  onEnhancements: () => void;
  onRun: () => void;
  onReduceSelection?: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const spec = getSpec(request.snapshot.specId);
  return (
    <aside className="run-summary" aria-label={t("run.setup")}>
      <div className="run-character section-top">
        <CharacterPortrait
          className={spec.className}
          snapshot={request.snapshot}
        />
        <div className="run-character-name">
          <h2>
            {request.snapshot.settings.player!.name || t("run.character")}
          </h2>
          <p className="muted small">
            {spec.name} ·{" "}
            {spec.className.replace("Deathknight", "Death Knight")} · 80
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-button !p-0 !min-h-9 !text-[13px]"
          onClick={() => onImport()}
        >
          {t("run.edit")}
        </Button>
      </div>
      <div className="run-configuration">
        <RunSettingRow icon="version">
          <label className="run-version-field">
            <span className="run-setting-title">{t("run.itemVersion")}</span>
            <Select
              aria-label={t("run.itemVersion")}
              value={itemVersionOf(request.snapshot)}
              onValueChange={(value) => {
                const itemVersion = value as ItemVersion;
                change({
                  ...request,
                  snapshot: {
                    ...request.snapshot,
                    itemVersion,
                    itemDataRevision: itemVersions[itemVersion].revision,
                    provenance: {
                      ...request.snapshot.provenance,
                      itemVersion: "edited",
                    },
                  },
                });
              }}
            >
              {Object.entries(itemVersions).map(([id, profile]) => (
                <SelectOption
                  key={id}
                  value={id}
                  description={t(`versions.${id}.description`)}
                >
                  {profile.label}
                </SelectOption>
              ))}
            </Select>
          </label>
        </RunSettingRow>
        <RunSettingRow icon="settings">
          <RunSettingAction onClick={onSettings}>
            {t("run.settings")}
          </RunSettingAction>
          <p className="run-setting-description">
            {t("run.targets", {
              count: request.snapshot.settings.encounter!.targets.length,
            })}{" "}
            ·{" "}
            {request.snapshot.settings.encounter!.duration.toLocaleString(
              locale,
            )}
            s
          </p>
        </RunSettingRow>
        <EnhancementSummary
          snapshot={request.snapshot}
          onOpen={() => onEnhancements()}
        />
      </div>
      <RunAllowance
        request={request}
        policy={policy}
        allowance={allowance}
        error={error}
        readinessError={readinessError}
        pending={pending}
        onRun={onRun}
        onReduceSelection={onReduceSelection}
      />
    </aside>
  );
}

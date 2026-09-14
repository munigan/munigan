"use client";
import { memo, type ReactNode } from "react";
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
import type { GearLabActions } from "./state/gear-lab-store";
import type { PurchaseAnalysisState } from "./purchases/purchase-worker-contract";
export function RunSetup({
  request,
  resourceCount,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  actions,
  onImport,
  onSettings,
  onEnhancements,
  onRun,
  onPurchases,
  purchaseAnalysis,
  feedback,
  onReduceSelection,
}: {
  feedback?: ReactNode;
  onReduceSelection?: () => void;
  request: Pick<TopGearRequest, "snapshot" | "iterations">;
  resourceCount: number;
  policy: WorkPolicy | null;
  allowance: ReturnType<typeof estimateAllowance> | null;
  error: string;
  readinessError: string;
  pending: boolean;
  actions: GearLabActions;
  onImport: () => void;
  onSettings: () => void;
  onEnhancements: () => void;
  onRun: () => void;
  onPurchases?: () => void;
  purchaseAnalysis?: PurchaseAnalysisState;
}) {
  const t = useTranslations("inventory");

  return (
    <aside className="run-summary" aria-label={t("run.setup")}>
      <RunConfiguration
        snapshot={request.snapshot}
        resourceCount={resourceCount}
        actions={actions}
        onImport={onImport}
        onSettings={onSettings}
        onEnhancements={onEnhancements}
        onPurchases={onPurchases}
      />
      <RunAllowance
        request={request}
        policy={policy}
        allowance={allowance}
        purchaseAnalysis={purchaseAnalysis}
        error={error}
        readinessError={readinessError}
        pending={pending}
        onRun={onRun}
        onReduceSelection={onReduceSelection}
        onIterationsChange={(iterations) => {
          if (policy) actions.setIterations(iterations, policy);
        }}
      />
      {feedback}
    </aside>
  );
}

const RunConfiguration = memo(function RunConfiguration({
  snapshot,
  resourceCount,
  actions,
  onImport,
  onSettings,
  onEnhancements,
  onPurchases,
}: {
  snapshot: TopGearRequest["snapshot"];
  resourceCount: number;
  actions: GearLabActions;
  onImport: () => void;
  onSettings: () => void;
  onEnhancements: () => void;
  onPurchases?: () => void;
}) {
  const t = useTranslations("inventory"),
    locale = useLocale();
  const spec = getSpec(snapshot.specId);
  return (
    <>
      <div className="run-character section-top">
        <CharacterPortrait className={spec.className} snapshot={snapshot} />
        <div className="run-character-name">
          <h2>{snapshot.settings.player!.name || t("run.character")}</h2>
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
              value={itemVersionOf(snapshot)}
              onValueChange={(value) => {
                actions.setItemVersion(value as ItemVersion);
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
              count: snapshot.settings.encounter!.targets.length,
            })}{" "}
            · {snapshot.settings.encounter!.duration.toLocaleString(locale)}s
          </p>
        </RunSettingRow>
        {resourceCount > 0 && (
          <RunSettingRow icon="settings">
            <RunSettingAction onClick={() => onPurchases?.()}>
              {t("purchases.summary")}
            </RunSettingAction>
            <p className="run-setting-description">
              {t("purchases.summaryCount", {
                count: resourceCount,
              })}
            </p>
          </RunSettingRow>
        )}
        <EnhancementSummary
          snapshot={snapshot}
          onOpen={() => onEnhancements()}
        />
      </div>
    </>
  );
});

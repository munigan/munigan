import { useTranslations, useLocale } from "next-intl";
import { AlertMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import type { estimateAllowance } from "@/domain/equipment/enumerate";
import { RunIterations } from "./RunIterations";
import type { PurchaseAnalysisState } from "./purchases/purchase-worker-contract";
export function RunAllowance({
  request,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  onRun,
  purchaseAnalysis,
  onIterationsChange,
}: {
  request: TopGearRequest;
  policy: WorkPolicy | null;
  allowance: ReturnType<typeof estimateAllowance> | null;
  error: string;
  readinessError: string;
  pending: boolean;
  onRun: () => void;
  purchaseAnalysis?: PurchaseAnalysisState;
  onIterationsChange?: (iterations: number) => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const purchaseStatus =
    purchaseAnalysis?.status === "ready"
      ? purchaseAnalysis.analysis.status
      : purchaseAnalysis?.status;
  const purchaseMessage =
    purchaseStatus && purchaseStatus !== "complete"
      ? t(
          `purchases.${purchaseStatus === "search-limit" ? "searchLimit" : purchaseStatus === "no-legal-sets" ? "noLegalSets" : purchaseStatus === "catalog-changed" ? "catalogChanged" : purchaseStatus === "error" ? "analysisError" : purchaseStatus === "over-limit" ? "overLimit" : "calculating"}`,
        )
      : "";
  const currentAllowance = purchaseAnalysis
    ? purchaseAnalysis.status === "ready" &&
      purchaseAnalysis.analysis.status === "complete"
      ? purchaseAnalysis.analysis.plan.allowance
      : purchaseAnalysis.status === "ready" &&
          purchaseAnalysis.analysis.status === "over-limit"
        ? purchaseAnalysis.analysis.allowance
        : null
    : allowance;
  allowance = currentAllowance;
  const selectedIterations = policy?.selectableIterations
    ? (request.iterations ?? policy.iterationsPerSet)
    : (policy?.iterationsPerSet ?? null);
  const unlimited = policy?.maxUnits === null;
  return (
    <div
      className="run-action"
      data-over-limit={allowance ? !allowance.allowed : false}
    >
      <div className="run-budget-panel">
        <div className="run-budget" aria-live="polite" aria-atomic="true">
          <div className="section-top">
            <span className="set-count">
              {allowance ? (
                <>
                  <strong>
                    {purchaseAnalysis && allowance.countKind === "over-limit"
                      ? "≥"
                      : ""}
                    {Math.min(allowance.count, 999999).toLocaleString(locale)}
                  </strong>{" "}
                  /{" "}
                  {unlimited
                    ? "∞"
                    : Math.floor(
                        policy!.maxUnits! / policy!.unitsPerSet,
                      ).toLocaleString(locale)}{" "}
                  {t("allowance.sets")}
                </>
              ) : (
                purchaseMessage || t("allowance.loading")
              )}
            </span>
            <span className="badge">
              {t(unlimited ? "allowance.local" : "allowance.free")}
            </span>
          </div>
          {!unlimited && (
            <progress
              aria-label={t("allowance.label")}
              max={policy?.maxUnits ?? 1}
              value={Math.min(allowance?.units ?? 0, policy?.maxUnits ?? 1)}
            />
          )}
        </div>
        <details className="allowance-help">
          <summary>{t("allowance.about")}</summary>
          <p>
            {t("allowance.units", {
              used: allowance?.units.toLocaleString(locale) ?? "—",
              max: unlimited
                ? "∞"
                : (policy?.maxUnits?.toLocaleString(locale) ?? "—"),
            })}
          </p>
          <p>
            {t("allowance.help", {
              iterations: selectedIterations?.toLocaleString(locale) ?? "—",
            })}
          </p>
        </details>
        <RunIterations
          iterations={selectedIterations}
          range={policy?.selectableIterations}
          onChange={onIterationsChange}
        />
      </div>
      {(error || readinessError || (allowance && !allowance.allowed)) && (
        <AlertMessage className="run-feedback" tone="error">
          {error || readinessError || t("allowance.reduce")}
        </AlertMessage>
      )}
      <Button
        variant="primary"
        className="primary run-button"
        disabled={
          pending ||
          !allowance?.allowed ||
          !!readinessError ||
          (!!purchaseAnalysis && purchaseStatus !== "complete")
        }
        onClick={onRun}
      >
        {pending ? t("run.submitting") : t("run.find")}{" "}
        <span aria-hidden="true">→</span>
      </Button>
      <p className="muted small run-caption">
        {request.snapshot.inventory.some((i) => i.source === "custom")
          ? t("run.customCaption")
          : request.snapshot.inventory.some((i) => i.source === "bag")
            ? t("run.bagsCaption")
            : t("run.equippedCaption")}
      </p>
    </div>
  );
}

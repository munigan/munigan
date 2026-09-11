import { useTranslations, useLocale } from "next-intl";
import { AlertMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import type { estimateAllowance } from "@/domain/equipment/enumerate";
import { RunIterations } from "./RunIterations";
export function RunAllowance({
  request,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  onRun,
}: {
  request: TopGearRequest;
  policy: WorkPolicy | null;
  allowance: ReturnType<typeof estimateAllowance> | null;
  error: string;
  readinessError: string;
  pending: boolean;
  onRun: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
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
                    {Math.min(allowance.count, 999999).toLocaleString(locale)}
                  </strong>{" "}
                  /{" "}
                  {Math.floor(
                    policy!.maxUnits / policy!.unitsPerSet,
                  ).toLocaleString(locale)}{" "}
                  {t("allowance.sets")}
                </>
              ) : (
                t("allowance.loading")
              )}
            </span>
            <span className="badge">{t("allowance.free")}</span>
          </div>
          <progress
            aria-label={t("allowance.label")}
            max={policy?.maxUnits ?? 1}
            value={Math.min(allowance?.units ?? 0, policy?.maxUnits ?? 1)}
          />
        </div>
        <details className="allowance-help">
          <summary>{t("allowance.about")}</summary>
          <p>
            {t("allowance.units", {
              used: allowance?.units.toLocaleString(locale) ?? "—",
              max: policy?.maxUnits.toLocaleString(locale) ?? "—",
            })}
          </p>
          <p>
            {t("allowance.help", {
              iterations:
                policy?.iterationsPerSet.toLocaleString(locale) ?? "—",
            })}
          </p>
        </details>
        <RunIterations iterations={policy?.iterationsPerSet ?? null} />
      </div>
      {(error || readinessError || (allowance && !allowance.allowed)) && (
        <AlertMessage className="run-feedback" tone="error">
          {error || readinessError || t("allowance.reduce")}
        </AlertMessage>
      )}
      <Button
        variant="primary"
        className="primary run-button"
        disabled={pending || !allowance?.allowed || !!readinessError}
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

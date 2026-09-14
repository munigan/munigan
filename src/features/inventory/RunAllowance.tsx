import { useTranslations, useLocale } from "next-intl";
import { AlertMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import type { estimateAllowance } from "@/domain/equipment/enumerate";
import { RunIterations } from "./RunIterations";
import { ProRunNotice } from "./ProRunNotice";
import { isCombinationLimitExceeded } from "./free-run-state";
import {
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { useEffect, useRef, useState } from "react";
export function RunAllowance({
  request,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  onRun,
  onReduceSelection = () => {},
}: {
  request: TopGearRequest;
  policy: WorkPolicy | null;
  allowance: ReturnType<typeof estimateAllowance> | null;
  error: string;
  readinessError: string;
  pending: boolean;
  onRun: () => void;
  onReduceSelection?: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const pointerType = useRef("");
  const overLimit = isCombinationLimitExceeded(policy, allowance);
  const showPro = overLimit && !error && !readinessError;
  const freeLimit =
    policy && policy.unitsPerSet > 0
      ? Math.floor(policy.maxUnits / policy.unitsPerSet)
      : 0;
  useEffect(() => {
    if (!tooltipOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      setTooltipOpen(false);
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [tooltipOpen]);
  return (
    <div className="run-action" data-over-limit={overLimit}>
      <div className="run-budget-panel">
        <div className="run-budget" aria-live="polite" aria-atomic="true">
          <div className="section-top">
            <span className="set-count">
              {allowance ? (
                <>
                  {allowance.countKind === "upper-bound" ? (
                    <strong>
                      {t("allowance.upTo", { count: allowance.count })}
                    </strong>
                  ) : (
                    <strong>
                      {t("allowance.exact", {
                        count: Math.min(allowance.count, 999999),
                      })}
                    </strong>
                  )}
                </>
              ) : (
                t("allowance.loading")
              )}
            </span>
            <span className="badge">
              {policy
                ? t("allowance.combinationLimit", { count: freeLimit })
                : t("allowance.free")}
            </span>
          </div>
          <progress
            aria-label={t("allowance.label")}
            max={policy?.maxUnits ?? 1}
            value={Math.min(allowance?.units ?? 0, policy?.maxUnits ?? 1)}
          />
        </div>
        <TooltipRoot open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger
            render={<button type="button" />}
            className="allowance-help"
            delay={250}
            closeOnClick={false}
            onPointerDown={(event) => {
              pointerType.current = event.pointerType;
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (pointerType.current === "touch")
                setTooltipOpen((open) => !open);
            }}
          >
            {t("allowance.about")}
          </TooltipTrigger>
          <TooltipContent className="allowance-tooltip">
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
          </TooltipContent>
        </TooltipRoot>
        {allowance?.countKind === "upper-bound" && overLimit && (
          <p className="run-count-note">{t("allowance.mayExceed")}</p>
        )}
        {allowance?.countKind === "exact" && overLimit && (
          <p className="run-count-note">
            {t("allowance.exactExcess", {
              count: allowance.count - freeLimit,
            })}
          </p>
        )}
        <RunIterations iterations={policy?.iterationsPerSet ?? null} />
      </div>
      {showPro && policy ? (
        <ProRunNotice
          freeLimit={freeLimit}
          freeIterations={policy.iterationsPerSet}
          onReduceSelection={onReduceSelection}
        />
      ) : (
        <section className="run-action-panel">
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
        </section>
      )}
    </div>
  );
}

"use client";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import { estimateAllowance } from "@/domain/equipment/enumerate";
import { RunAllowance } from "./RunAllowance";
import type { GearLabActions } from "./state/gear-lab-store";
import type { PurchaseAnalysisState } from "./purchases/purchase-worker-contract";
export function RunSetup({
  request,
  policy,
  allowance,
  error,
  readinessError,
  pending,
  actions,
  onRun,
  purchaseAnalysis,
  feedback,
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
      <RunAllowance
        request={request}
        policy={policy}
        allowance={allowance}
        purchaseAnalysis={purchaseAnalysis}
        error={error}
        readinessError={readinessError}
        pending={pending}
        onRun={onRun}
        onIterationsChange={(iterations) => {
          if (policy) actions.setIterations(iterations, policy);
        }}
      />
      {feedback}
    </aside>
  );
}

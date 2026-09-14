"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAccount } from "@/features/auth/AuthProvider";
import { describeError, type ErrorDescriptor } from "@/i18n/error";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import type { WorkPolicy } from "@/domain/top-gear/model";
import {
  createAttempt,
  submitAttempt,
  loadAttempt,
  canSwitchMode,
  discardRejectedAttempt,
  type AdmissionAttempt,
} from "../admission-attempt";
import type { GearLabStore } from "./gear-lab-store";
import type { AnalysisController } from "./gear-lab-analysis";
import type { DraftPersistence } from "./gear-lab-persistence";
import type { NonPurchaseView } from "./gear-lab-selectors";

export function useGearLabAdmission({
  store,
  getAnalysis,
  persistence,
  policy,
  readNonPurchase,
  onStorageError,
}: {
  store: GearLabStore;
  // The stable runtime owns controller replacement during effect replay.
  getAnalysis: () => AnalysisController;
  persistence: DraftPersistence;
  policy: WorkPolicy | null;
  readNonPurchase: () => NonPurchaseView | null;
  onStorageError: (error: unknown) => void;
}) {
  const auth = useAccount();
  const router = useRouter();
  const ti = useTranslations("inventory");
  const attempt = useRef<AdmissionAttempt | null>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<"account" | "uncertain" | null>(null);
  const [error, setError] = useState<ErrorDescriptor | null>(null);
  const reportStorageError = useEffectEvent(onStorageError);
  useEffect(() => {
    let active = true;
    try {
      attempt.current = loadAttempt();
      if (attempt.current) {
        const recoveredIssue = canSwitchMode(attempt.current)
          ? "account"
          : "uncertain";
        queueMicrotask(() => {
          if (active) setIssue(recoveredIssue);
        });
      }
    } catch (error) {
      queueMicrotask(() => {
        if (!active) return;
        setIssue("uncertain");
        setError(describeError(error));
      });
    }
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.draft === previous.draft) return;
      setError(null);
      if (!submitting.current && attempt.current?.status === "rejected") {
        try {
          discardRejectedAttempt(attempt.current);
          attempt.current = null;
        } catch (error) {
          reportStorageError(error);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);
  async function run(withoutSaving = false) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      // Recover before choosing a new mode/key, including after a storage error.
      if (!attempt.current) attempt.current = loadAttempt();
      if (withoutSaving && attempt.current && !canSwitchMode(attempt.current)) {
        setIssue("uncertain");
        return;
      }
      const currentAuth =
        !attempt.current &&
        !withoutSaving &&
        ["loading", "unavailable"].includes(auth.status)
          ? ((await auth.refresh()) ?? auth)
          : auth;
      if (
        !attempt.current &&
        !withoutSaving &&
        ["loading", "unavailable"].includes(currentAuth.status)
      ) {
        setIssue("account");
        return;
      }
      if (withoutSaving || !attempt.current) {
        // Read after auth refresh: controls may have edited the draft while it awaited.
        const request = store.getState().draft;
        if (!request || !policy) return;
        const analysis = getAnalysis().getSnapshot();
        const purchaseAnalysis = analysis.state;
        if (
          request.purchases &&
          !(
            analysis.revision === analysis.completedRevision &&
            purchaseAnalysis.status === "ready" &&
            !purchaseAnalysis.refreshing &&
            purchaseAnalysis.analysis.status === "complete" &&
            purchaseAnalysis.analysis.plan.allowance.allowed
          )
        ) {
          setError({ message: ti("purchases.calculating") });
          return;
        }
        if (!request.purchases) {
          const current = readNonPurchase();
          if (!current?.allowance.allowed) return;
          if (
            current.enhancementAnalysis?.complete &&
            current.enhancementAnalysis.validCount === 0
          ) {
            setError({ message: ti("editor.noValidSets") });
            return;
          }
        }
        const payload = encodeRequest(request);
        validateRequest(payload);
        persistence.flush();
        attempt.current = createAttempt(
          payload,
          withoutSaving || currentAuth.status === "anonymous"
            ? "anonymous"
            : "account",
        );
      }
      const submitted = JSON.parse(attempt.current.body);
      delete submitted.authMode;
      const reportUrl = await submitAttempt(attempt.current);
      attempt.current = null;
      try {
        persistence.complete(submitted);
      } catch (e) {
        // Admission already succeeded; local storage must not prevent opening its report.
        onStorageError(e);
      }
      setIssue(null);
      router.push(reportUrl);
    } catch (e) {
      setError(describeError(e));
      setIssue(
        attempt.current && canSwitchMode(attempt.current)
          ? "account"
          : "uncertain",
      );
    } finally {
      setPending(false);
      submitting.current = false;
    }
  }
  return { run, pending, issue, error };
}

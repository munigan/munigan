"use client";
import { CharacterBackground } from "@/features/shell/CharacterBackground";
import { describeError, type ErrorDescriptor } from "@/i18n/error";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useTranslations } from "next-intl";
import {
  Alert,
  AlertContent,
  AlertActions,
  AlertAction,
  AlertMessage,
} from "@/components/ui/Alert";
import { PageHeading } from "@/components/ui/layout";
import { Button } from "@/components/ui/Button";
import { useEffect, useEffectEvent, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  Snapshot,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import {
  ImportPanel,
  type ImportPanelHandle,
} from "@/features/import/ImportPanel";
import { SavedDraftNotice } from "@/features/import/SavedDraftNotice";
import { InventorySelector } from "./InventorySelector";
import { PresetPanel } from "@/features/settings/PresetPanel";
import { ItemVersionContext } from "./ItemVersionContext";
import { GemmingPanel } from "./GemmingPanel";
import { defaultGemming } from "@/domain/equipment/gemming";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { RunSetup } from "./RunSetup";
import "./inventory-design.css";
import { validateItem } from "@/domain/equipment/validate";
import {
  estimateAllowance,
  analyzeItemEnhancementSets,
} from "@/domain/equipment/enumerate";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import {
  draftKey,
  saveDraft,
  loadDraft,
  clearDraft,
  clearMatchingDraft,
} from "@/features/import/draft-store";
import { importFormDraftKey } from "@/features/import/import-form-draft";
import { useAccount } from "../auth/AuthProvider";
import { SignInDialog } from "../auth/SignInDialog";
import {
  createAttempt,
  submitAttempt,
  loadAttempt,
  canSwitchMode,
  discardRejectedAttempt,
  type AdmissionAttempt,
} from "./admission-attempt";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";
import { proBeforeSignInEvent } from "@/features/pro-launch/ProLaunchProvider";

export function TopGearApp({ autoRestore = false }: { autoRestore?: boolean }) {
  const t = useTranslations("import");
  const ta = useTranslations("auth");
  const auth = useAccount();
  const [admissionIssue, setAdmissionIssue] = useState<
    "account" | "uncertain" | null
  >(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const attempt = useRef<AdmissionAttempt | null>(null);
  const submitting = useRef(false);
  const completedRequest = useRef<TopGearRequest | null>(null);
  const ti = useTranslations("inventory");
  const td = useTranslations("diagnostics");
  const router = useRouter();
  const [request, setRequest] = useState<TopGearRequest | null>(null),
    [policy, setPolicy] = useState<WorkPolicy | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [enhancementsOpen, setEnhancementsOpen] = useState(false),
    [error, setError] = useState<ErrorDescriptor | null>(null),
    [pending, setPending] = useState(false),
    [hasDraft, setHasDraft] = useState(false),
    [replace, setReplace] = useState(false),
    [storageError, setStorageError] = useState<ErrorDescriptor | null>(null);
  const importPanel = useRef<ImportPanelHandle>(null);
  const equipmentSelection = useRef<HTMLElement>(null);
  const [importRevision, setImportRevision] = useState(0);
  const [selectionVisit, setSelectionVisit] = useState({
    revision: 0,
  });
  function restoreSelection(draft: TopGearRequest) {
    setSelectionVisit((visit) => ({
      revision: visit.revision + 1,
    }));
    change(draft);
  }
  const returnToStart = useEffectEvent((event: Event) => {
    try {
      if (request && request !== completedRequest.current) saveDraft(request);
      importPanel.current?.saveForLater();
      const saved = !!(
        localStorage.getItem(importFormDraftKey) ||
        localStorage.getItem(draftKey)
      );
      setRequest(null);
      setReplace(false);
      setSettingsOpen(false);
      setEnhancementsOpen(false);
      setRestoring(false);
      setError(null);
      setHasDraft(saved);
      setImportRevision((revision) => revision + 1);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) {
      event.preventDefault();
      setStorageError(describeError(error));
    }
  });
  useEffect(() => {
    const start = (event: Event) => returnToStart(event);
    window.addEventListener(topGearStartEvent, start);
    return () => window.removeEventListener(topGearStartEvent, start);
  }, []);
  const preserveForPro = useEffectEvent((event: Event) => {
    try {
      if (request) saveDraft(request);
      importPanel.current?.saveForLater();
      if (request)
        sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
    } catch (error) {
      event.preventDefault();
      setStorageError(describeError(error));
    }
  });
  useEffect(() => {
    const listener = (event: Event) => preserveForPro(event);
    window.addEventListener(proBeforeSignInEvent, listener);
    return () => window.removeEventListener(proBeforeSignInEvent, listener);
  }, []);

  const [restoring, setRestoring] = useState(autoRestore);
  const restoreFromReport = useEffectEvent(() => {
    try {
      const draft = loadDraft();
      if (draft) restoreSelection(draft);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setRestoring(false);
    }
  });
  useEffect(() => {
    try {
      attempt.current = loadAttempt();
      if (attempt.current) {
        const issue = canSwitchMode(attempt.current) ? "account" : "uncertain";
        queueMicrotask(() => setAdmissionIssue(issue));
      }
      const returning =
        sessionStorage.getItem("munigan.top-gear.signin-restore") === "1";
      if (!autoRestore && !returning && !attempt.current) return;
    } catch (e) {
      queueMicrotask(() => {
        setAdmissionIssue("uncertain");
        setError(describeError(e));
        setRestoring(false);
      });
      return;
    }
    const frame = requestAnimationFrame(() => {
      try {
        sessionStorage.removeItem("munigan.top-gear.signin-restore");
      } catch (e) {
        setStorageError(describeError(e));
      }
      restoreFromReport();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoRestore]);
  useEffect(() => {
    fetch("/api/top-gear/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.policy) setPolicy(d.policy);
        else setError(describeError(d));
        try {
          setHasDraft(
            !!(
              localStorage.getItem(draftKey) ||
              localStorage.getItem(importFormDraftKey)
            ),
          );
        } catch {
          setStorageError(
            describeError(
              "Local draft storage is unavailable in this browser.",
            ),
          );
        }
      })
      .catch(() =>
        setError(
          describeError(
            "Could not connect to the simulation service. Reload to try again.",
          ),
        ),
      );
  }, []);
  function change(next: TopGearRequest) {
    const excluded = next.snapshot.inventory
      .filter(
        (i) => i.source === "bag" && validateItem(next.snapshot, i).length > 0,
      )
      .map((i) => i.instanceId);
    next = {
      ...next,
      snapshot: {
        ...next.snapshot,
        gemming: next.snapshot.gemming ?? defaultGemming(next.snapshot),
        autoEnchant: next.snapshot.autoEnchant ?? true,
      },
      selection: {
        ...next.selection,
        selectedInstanceIds: next.selection.selectedInstanceIds.filter(
          (id) => !excluded.includes(id),
        ),
        acknowledgedExclusions: excluded,
        // Retired slot locks must not constrain restored drafts.
        lockedSlots: {},
      },
    };
    setRequest(next);
    if (attempt.current?.status === "rejected") {
      try {
        discardRejectedAttempt(attempt.current);
        attempt.current = null;
      } catch (e) {
        setStorageError(describeError(e));
      }
    }
    setError(null);
    try {
      saveDraft(next);
      setHasDraft(true);
    } catch {
      setStorageError(
        describeError(
          "Your selection is kept on this page, but could not be saved in this browser.",
        ),
      );
    }
  }
  function resolved(snapshot: Snapshot) {
    setSelectionVisit((visit) => ({
      revision: visit.revision + 1,
    }));
    change({
      tool: "top-gear",
      precision: "standard",
      snapshot,
      selection: {
        selectedInstanceIds: snapshot.inventory
          .filter(
            (i) =>
              i.source === "equipped" && validateItem(snapshot, i).length === 0,
          )
          .map((i) => i.instanceId),
        lockedSlots: {},
        acknowledgedExclusions: snapshot.inventory
          .filter(
            (i) => i.source === "bag" && validateItem(snapshot, i).length > 0,
          )
          .map((i) => i.instanceId),
      },
    });
    setReplace(false);
  }
  async function run(withoutSaving = false) {
    if (!request || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      // Recover before choosing a new mode/key, including after a storage error.
      if (!attempt.current) attempt.current = loadAttempt();
      if (withoutSaving && attempt.current && !canSwitchMode(attempt.current)) {
        setAdmissionIssue("uncertain");
        return;
      }
      if (
        !attempt.current &&
        !withoutSaving &&
        ["loading", "unavailable"].includes(auth.status)
      ) {
        setAdmissionIssue("account");
        return;
      }
      validateRequest(encodeRequest(request));
      saveDraft(request);
      if (withoutSaving || !attempt.current)
        attempt.current = createAttempt(
          encodeRequest(request),
          withoutSaving || auth.status === "anonymous"
            ? "anonymous"
            : "account",
        );
      const submitted = JSON.parse(attempt.current.body);
      delete submitted.authMode;
      const reportUrl = await submitAttempt(attempt.current);
      completedRequest.current = request;
      attempt.current = null;
      try {
        if (clearMatchingDraft(submitted)) setHasDraft(false);
      } catch (e) {
        // Admission already succeeded; local storage must not prevent opening its report.
        setStorageError(describeError(e));
      }
      setAdmissionIssue(null);
      router.push(reportUrl);
    } catch (e) {
      setError(describeError(e));
      setAdmissionIssue(
        attempt.current && canSwitchMode(attempt.current)
          ? "account"
          : "uncertain",
      );
    } finally {
      setPending(false);
      submitting.current = false;
    }
  }
  function signInForRun() {
    try {
      if (request) saveDraft(request);
      sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
      setSignInOpen(true);
    } catch (e) {
      setStorageError(describeError(e));
    }
  }
  const enhancementAnalysis = useMemo(
    () =>
      request && Object.keys(request.snapshot.itemEnhancements ?? {}).length
        ? analyzeItemEnhancementSets(request.snapshot, request.selection)
        : null,
    [request],
  );
  const allowance = useMemo(
    () =>
      request && policy
        ? estimateAllowance(
            request.snapshot,
            request.selection,
            policy,
            undefined,
            enhancementAnalysis ?? undefined,
          )
        : null,
    [request, policy, enhancementAnalysis],
  );
  const readinessError = useMemo(() => {
    if (!request) return null;
    try {
      validateRequest(encodeRequest(request));
      return null;
    } catch (error) {
      return describeError(error);
    }
  }, [request]);
  // Avoid briefly showing the import form during an explicit report edit.
  if (restoring) return null;
  return (
    <ItemVersionContext.Provider
      value={request ? itemVersionOf(request.snapshot) : "original"}
    >
      <section id="content" className="gear-lab-page">
        {!replace && <CharacterBackground specId={request?.snapshot.specId} />}
        <PageHeading className="page-heading">
          <h1>GEAR LAB</h1>
          <p>{request ? t("selectIntro") : t("importIntro")}</p>
          {request && (
            <Button
              variant="ghost"
              className="text-button heading-action"
              onClick={() => setReplace(true)}
            >
              {t("importCharacter")}
            </Button>
          )}
        </PageHeading>
        {!request ? (
          <>
            {hasDraft && (
              <SavedDraftNotice
                key={`draft-${importRevision}`}
                onRestore={() => {
                  try {
                    if (importPanel.current?.restoreDraft()) {
                      setHasDraft(false);
                      return;
                    }
                    const draft = loadDraft();
                    if (draft) restoreSelection(draft);
                  } catch (e) {
                    setError(describeError(e));
                  }
                }}
                onDiscard={() => {
                  try {
                    clearDraft();
                    setHasDraft(false);
                  } catch {
                    setStorageError(
                      describeError("Could not clear local storage"),
                    );
                  }
                }}
              />
            )}
            <ImportPanel
              key={importRevision}
              ref={importPanel}
              onResolved={resolved}
            />
          </>
        ) : replace ? (
          <>
            <Alert className="mt-0 mb-8">
              <AlertContent>{t("replaceHelp")}</AlertContent>
              <AlertActions>
                <AlertAction onClick={() => setReplace(false)}>
                  {t("keepCharacter")}
                </AlertAction>
              </AlertActions>
            </Alert>
            <ImportPanel
              key={importRevision}
              ref={importPanel}
              onResolved={resolved}
            />
          </>
        ) : (
          <div className="gear-layout">
            <InventorySelector
              ref={equipmentSelection}
              key={selectionVisit.revision}
              request={request}
              onChange={change}
              enhancementAnalysis={enhancementAnalysis}
            />
            <RunSetup
              request={request}
              policy={policy}
              allowance={allowance}
              error={error ? localizeDiagnostic(error, td) : ""}
              readinessError={
                readinessError
                  ? localizeDiagnostic(readinessError, td)
                  : enhancementAnalysis?.complete &&
                      enhancementAnalysis.validCount === 0
                    ? ti("editor.noValidSets")
                    : ""
              }
              pending={pending}
              onChange={change}
              onImport={() => setReplace(true)}
              onSettings={() => setSettingsOpen(true)}
              onEnhancements={() => setEnhancementsOpen(true)}
              onRun={() => void run()}
              onReduceSelection={() => {
                equipmentSelection.current?.focus({ preventScroll: true });
                equipmentSelection.current?.scrollIntoView({
                  block: "start",
                  behavior: "auto",
                });
              }}
            />
          </div>
        )}
        {error && (!request || replace) && (
          <AlertMessage tone="error">
            {localizeDiagnostic(error, td)}
          </AlertMessage>
        )}
        {admissionIssue && (
          <div className="report-save-notice" role="alert">
            <div>
              <p>
                {ta(
                  admissionIssue === "uncertain"
                    ? "admissionUncertain"
                    : "admissionAccount",
                )}
              </p>
              <div className="actions">
                <Button
                  disabled={pending || !request}
                  onClick={() => void run()}
                >
                  {ta("retryReturn")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={signInForRun}
                >
                  {ta("signIn")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={
                    pending || admissionIssue === "uncertain" || !request
                  }
                  onClick={() => void run(true)}
                >
                  {ta("runWithoutSaving")}
                </Button>
              </div>
            </div>
          </div>
        )}
        <SignInDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          callbackPath="/gear-lab"
        />
        {storageError && (
          <AlertMessage>{localizeDiagnostic(storageError, td)}</AlertMessage>
        )}
        {enhancementsOpen && request && (
          <GemmingPanel
            snapshot={request.snapshot}
            onChange={(snapshot) => change({ ...request, snapshot })}
            onClose={() => setEnhancementsOpen(false)}
          />
        )}
        {settingsOpen && request && (
          <PresetPanel
            snapshot={request.snapshot}
            onChange={(snapshot) => change({ ...request, snapshot })}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </section>
    </ItemVersionContext.Provider>
  );
}

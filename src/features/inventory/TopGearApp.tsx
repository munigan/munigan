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
import {
  useEffect,
  useEffectEvent,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { RunSetup } from "./RunSetup";
import "./inventory-design.css";
import { validateItem } from "@/domain/equipment/validate";
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
import { createReadinessRequestSelector } from "./state/gear-lab-selectors";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";

import { enhancementDiagnosticText } from "./enhancements/enhancement-labels";
import { ResourceWallet } from "./purchases/ResourceWallet";
import { PurchasableItemsDialog } from "./purchases/PurchasableItemsDialog";
import {
  GearLabProvider,
  useGearLabSelector,
  useGearLabStore,
} from "./state/GearLabProvider";
import {
  GearLabRuntimeProvider,
  useGearLabRuntime,
  useAnalysisView,
} from "./state/GearLabRuntime";
import {
  createDraftPersistence,
  type DraftPersistence,
} from "./state/gear-lab-persistence";

export function TopGearApp({ autoRestore = false }: { autoRestore?: boolean }) {
  return (
    <GearLabProvider>
      <GearLabRuntimeProvider>
        <TopGearShell autoRestore={autoRestore} />
      </GearLabRuntimeProvider>
    </GearLabProvider>
  );
}
function TopGearShell({ autoRestore }: { autoRestore: boolean }) {
  const store = useGearLabStore();
  const actions = useGearLabSelector((state) => state.actions);
  const request = useGearLabSelector((state) => state.draft);
  const runtime = useGearLabRuntime();
  const persistence = useRef<DraftPersistence | null>(null);
  const t = useTranslations("import");
  const ta = useTranslations("auth");
  const auth = useAccount();
  const [admissionIssue, setAdmissionIssue] = useState<
    "account" | "uncertain" | null
  >(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const attempt = useRef<AdmissionAttempt | null>(null);
  const submitting = useRef(false);
  const ti = useTranslations("inventory");
  const td = useTranslations("diagnostics");
  const router = useRouter();
  const [serverPolicy, setPolicy] = useState<WorkPolicy | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [enhancementsOpen, setEnhancementsOpen] = useState(false),
    [error, setError] = useState<ErrorDescriptor | null>(null),
    [pending, setPending] = useState(false),
    [hasDraft, setHasDraft] = useState(false),
    [replace, setReplace] = useState(false),
    [storageError, setStorageError] = useState<ErrorDescriptor | null>(null);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState("");
  const policy = serverPolicy;
  useEffect(
    () => runtime.session.setPolicy(serverPolicy),
    [runtime, serverPolicy],
  );
  const analysisSession = useAnalysisView();
  const purchaseAnalysis = analysisSession.view.state;
  useEffect(() => {
    const owner = createDraftPersistence(store, {
      save: (draft) => {
        saveDraft(draft);
        setHasDraft(true);
      },
      clear: clearDraft,
      clearMatching: (submitted) => {
        const cleared = clearMatchingDraft(submitted);
        if (cleared) setHasDraft(false);
        return cleared;
      },
      onError: (error) => setStorageError(describeError(error)),
    });
    persistence.current = owner;
    const unsubscribe = store.subscribe(() => {
      setError(null);
      if (attempt.current?.status === "rejected") {
        try {
          discardRejectedAttempt(attempt.current);
          attempt.current = null;
        } catch (error) {
          setStorageError(describeError(error));
        }
      }
    });
    return () => {
      unsubscribe();
      try {
        owner.dispose();
      } catch (error) {
        setStorageError(describeError(error));
      }
    };
  }, [store]);
  const openImport = useCallback(() => setReplace(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openEnhancements = useCallback(() => setEnhancementsOpen(true), []);
  const openPurchases = useCallback(() => setPurchasesOpen(true), []);
  const importPanel = useRef<ImportPanelHandle>(null);
  const [importRevision, setImportRevision] = useState(0);
  const [selectionVisit, setSelectionVisit] = useState({
    revision: 0,
  });
  function restoreSelection(draft: TopGearRequest) {
    setSelectionVisit((visit) => ({
      revision: visit.revision + 1,
    }));
    actions.replaceDraft(draft);
  }
  const returnToStart = useEffectEvent((event: Event) => {
    try {
      persistence.current?.flush();
      importPanel.current?.saveForLater();
      const saved = !!(
        localStorage.getItem(importFormDraftKey) ||
        localStorage.getItem(draftKey)
      );
      actions.replaceDraft(null);
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
  function resolved(snapshot: Snapshot) {
    setSelectionVisit((visit) => ({
      revision: visit.revision + 1,
    }));
    actions.replaceDraft({
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
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      // Recover before choosing a new mode/key, including after a storage error.
      if (!attempt.current) attempt.current = loadAttempt();
      if (withoutSaving && attempt.current && !canSwitchMode(attempt.current)) {
        setAdmissionIssue("uncertain");
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
        setAdmissionIssue("account");
        return;
      }
      if (withoutSaving || !attempt.current) {
        if (!request) return;
        if (
          request.purchases &&
          !(
            purchaseAnalysis.status === "ready" &&
            !purchaseAnalysis.refreshing &&
            purchaseAnalysis.analysis.status === "complete" &&
            purchaseAnalysis.analysis.plan.allowance.allowed
          )
        ) {
          setError({ message: ti("purchases.calculating") });
          return;
        }
        validateRequest(encodeRequest(request));
        persistence.current?.flush();
        attempt.current = createAttempt(
          encodeRequest(request),
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
        persistence.current?.complete(submitted);
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
      persistence.current?.flush();
      sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
      setSignInOpen(true);
    } catch (e) {
      setStorageError(describeError(e));
    }
  }
  const enhancementAnalysis =
    analysisSession.nonPurchase?.enhancementAnalysis ?? null;
  const allowance = analysisSession.nonPurchase?.allowance ?? null;
  const selectReadiness = useMemo(() => createReadinessRequestSelector(), []);
  const readinessRequest = useGearLabSelector(selectReadiness);
  const readinessError = useMemo(() => {
    if (!readinessRequest) return null;
    try {
      validateRequest(encodeRequest(readinessRequest));
      return null;
    } catch (error) {
      return describeError(error);
    }
  }, [readinessRequest]);
  // Avoid briefly showing the import form during an explicit report edit.
  if (restoring) return null;
  const admissionFeedback = admissionIssue && (
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
          <Button disabled={pending} onClick={() => void run()}>
            {ta("retryReturn")}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={signInForRun}>
            {ta("signIn")}
          </Button>
          <Button
            variant="ghost"
            disabled={pending || admissionIssue === "uncertain" || !request}
            onClick={() => void run(true)}
          >
            {ta("runWithoutSaving")}
          </Button>
        </div>
      </div>
    </div>
  );
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
            <div className="inventory-with-wallet">
              <ResourceWallet onReview={openPurchases} />
              {purchaseAnalysis.status === "error" && (
                <div className="purchase-analysis-repair" role="alert">
                  <p>
                    {purchaseAnalysis.diagnostic.code === "serviceConnection"
                      ? ti("purchases.analysisError")
                      : localizeDiagnostic(purchaseAnalysis.diagnostic, td)}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => analysisSession.controller.retry()}
                  >
                    {ti("purchases.retry")}
                  </Button>
                  {purchaseAnalysis.diagnostic.diagnostics?.map(
                    (diagnostic, index) => (
                      <p className="muted small" key={index}>
                        {enhancementDiagnosticText(diagnostic, ti)}
                      </p>
                    ),
                  )}
                  {purchaseAnalysis.diagnostic.code ===
                    "purchaseEnhancementInvalid" &&
                    purchaseAnalysis.diagnostic.params?.profile ===
                      itemVersionOf(request.snapshot) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          actions.setPurchaseEnhancements(
                            purchaseAnalysis.diagnostic.params!.itemId,
                            {},
                          )
                        }
                      >
                        {ti("purchases.resetEnhancements", {
                          itemId: purchaseAnalysis.diagnostic.params.itemId,
                        })}
                      </Button>
                    )}
                </div>
              )}
              {purchaseAnalysis.status === "ready" &&
                purchaseAnalysis.analysis.status === "catalog-changed" && (
                  <div className="purchase-analysis-repair" role="alert">
                    <p>{ti("purchases.catalogChanged")}</p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const removedItemIds = actions.revalidatePurchases();
                        setCatalogNotice(
                          removedItemIds.length
                            ? ti("purchases.removedChoices", {
                                items: removedItemIds.join(", "),
                              })
                            : ti("purchases.catalogReviewed"),
                        );
                      }}
                    >
                      {ti("purchases.revalidate")}
                    </Button>
                  </div>
                )}
              {catalogNotice && (
                <p role="status" className="muted small">
                  {catalogNotice}
                </p>
              )}
              <InventorySelector key={selectionVisit.revision} />
            </div>
            <RunSetup
              request={request}
              policy={policy}
              allowance={allowance}
              purchaseAnalysis={
                request.purchases ? purchaseAnalysis : undefined
              }
              onPurchases={openPurchases}
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
              feedback={admissionFeedback}
              actions={actions}
              onImport={openImport}
              onSettings={openSettings}
              onEnhancements={openEnhancements}
              onRun={() => void run()}
            />
          </div>
        )}
        {error && (!request || replace) && (
          <AlertMessage tone="error">
            {localizeDiagnostic(error, td)}
          </AlertMessage>
        )}
        {(!request || replace) && admissionFeedback}
        {request && (
          <PurchasableItemsDialog
            request={request}
            preview={analysisSession.view.preview}
            open={purchasesOpen}
            onOpenChange={setPurchasesOpen}
            actions={actions}
          />
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
            actions={actions}
            onClose={() => setEnhancementsOpen(false)}
          />
        )}
        {settingsOpen && request && (
          <PresetPanel
            snapshot={request.snapshot}
            onChange={({ specId, settings, provenance, professionLevels }) =>
              actions.applySettings({
                specId,
                settings,
                provenance,
                professionLevels,
              })
            }
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </section>
    </ItemVersionContext.Provider>
  );
}

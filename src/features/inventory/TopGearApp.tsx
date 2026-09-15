"use client";
import { CharacterBackground } from "@/features/shell/CharacterBackground";
import { type ErrorDescriptor } from "@/i18n/error";
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
  useRef,
  useState,
  useCallback,
  useMemo,
  type ComponentProps,
} from "react";
import { ImportPanel } from "@/features/import/ImportPanel";
import { SavedDraftNotice } from "@/features/import/SavedDraftNotice";
import { InventorySelector } from "./InventorySelector";
import { PresetPanel } from "@/features/settings/PresetPanel";
import { ItemVersionContext } from "./ItemVersionContext";
import { GemmingPanel } from "./GemmingPanel";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { GearLabHeader } from "./GearLabHeader";
import { RunSetup } from "./RunSetup";
import "./inventory-design.css";
import { SignInDialog } from "../auth/SignInDialog";
import { useGearLabAdmission } from "./state/useGearLabAdmission";
import { useGearLabSession } from "./state/useGearLabSession";
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
  const equipmentSelection = useRef<HTMLElement>(null);
  const store = useGearLabStore();
  const hasRequest = useGearLabSelector((state) => !!state.draft);
  const specId = useGearLabSelector((state) => state.draft?.snapshot.specId);
  const itemVersion = useGearLabSelector((state) =>
    state.draft ? itemVersionOf(state.draft.snapshot) : "original",
  );
  const runtime = useGearLabRuntime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enhancementsOpen, setEnhancementsOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const onStart = useCallback(() => {
    setSettingsOpen(false);
    setEnhancementsOpen(false);
    setPurchasesOpen(false);
  }, []);
  const lifecycle = useGearLabSession({ autoRestore, onStart });
  const {
    policy,
    storageError,
    hasDraft,
    replace,
    setReplace,
    signInOpen,
    setSignInOpen,
    importPanel,
    importRevision,
    selectionRevision,
    restoring,
    resolved,
    signInForRun,
    openImport,
    restoreSavedDraft,
    discardSavedDraft,
  } = lifecycle;
  const admission = useGearLabAdmission({
    store,
    getAnalysis: () => runtime.session.getSnapshot().controller,
    persistence: lifecycle.persistence,
    policy,
    readNonPurchase: runtime.session.readNonPurchase,
    onStorageError: lifecycle.reportStorageError,
  });
  const { issue: admissionIssue, pending, run } = admission;
  const error = admission.error ?? lifecycle.error;
  const t = useTranslations("import");
  const ta = useTranslations("auth");
  const td = useTranslations("diagnostics");
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openEnhancements = useCallback(() => setEnhancementsOpen(true), []);
  const openPurchases = useCallback(() => setPurchasesOpen(true), []);
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
            disabled={pending || admissionIssue === "uncertain" || !hasRequest}
            onClick={() => void run(true)}
          >
            {ta("runWithoutSaving")}
          </Button>
        </div>
      </div>
    </div>
  );
  return (
    <ItemVersionContext.Provider value={itemVersion}>
      <section id="content" className="gear-lab-page">
        {!replace && <CharacterBackground specId={specId} />}
        {(!hasRequest || replace) && (
          <PageHeading className="page-heading">
            <h1>GEAR LAB</h1>
            <p>{hasRequest ? t("selectIntro") : t("importIntro")}</p>
            {hasRequest && (
              <Button
                variant="ghost"
                className="text-button heading-action"
                onClick={openImport}
              >
                {t("importCharacter")}
              </Button>
            )}
          </PageHeading>
        )}
        {!hasRequest ? (
          <>
            {hasDraft && (
              <SavedDraftNotice
                key={`draft-${importRevision}`}
                onRestore={restoreSavedDraft}
                onDiscard={discardSavedDraft}
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
              <GearLabHeader
                onImport={openImport}
                onSettings={openSettings}
                onEnhancements={openEnhancements}
              />
              <ResourceWallet onReview={openPurchases} />
              <PurchaseRepair />
              <InventorySelector
                ref={equipmentSelection}
                key={selectionRevision}
              />
            </div>
            <ConnectedRunSetup
              eligibilityError={lifecycle.readinessError}
              policy={policy}
              onPurchases={openPurchases}
              error={error ? localizeDiagnostic(error, td) : ""}
              pending={pending}
              feedback={admissionFeedback}
              onImport={openImport}
              onSettings={openSettings}
              onEnhancements={openEnhancements}
              onReduceSelection={() => {
                equipmentSelection.current?.focus({ preventScroll: true });
                equipmentSelection.current?.scrollIntoView({
                  block: "start",
                  behavior: "auto",
                });
              }}
              onRun={() => void run()}
            />
          </div>
        )}
        {error && (!hasRequest || replace) && (
          <AlertMessage tone="error">
            {localizeDiagnostic(error, td)}
          </AlertMessage>
        )}
        {(!hasRequest || replace) && admissionFeedback}
        {hasRequest && (
          <ConnectedPurchases
            open={purchasesOpen}
            onOpenChange={setPurchasesOpen}
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
        {enhancementsOpen && hasRequest && (
          <ConnectedGemming onClose={() => setEnhancementsOpen(false)} />
        )}
        {settingsOpen && hasRequest && (
          <ConnectedSettings onClose={() => setSettingsOpen(false)} />
        )}
      </section>
    </ItemVersionContext.Provider>
  );
}

function PurchaseRepair() {
  const actions = useGearLabSelector((state) => state.actions);
  const itemVersion = useGearLabSelector((state) =>
    state.draft ? itemVersionOf(state.draft.snapshot) : "original",
  );
  const runtime = useGearLabRuntime();
  const purchaseAnalysis = useAnalysisView().view.state;
  const [catalogNotice, setCatalogNotice] = useState("");
  const ti = useTranslations("inventory"),
    td = useTranslations("diagnostics");
  return (
    <>
      {" "}
      {purchaseAnalysis.status === "error" && (
        <div className="purchase-analysis-repair" role="alert">
          <p>
            {purchaseAnalysis.diagnostic.code === "serviceConnection"
              ? ti("purchases.analysisError")
              : localizeDiagnostic(purchaseAnalysis.diagnostic, td)}
          </p>
          <Button
            variant="secondary"
            onClick={() => runtime.session.getSnapshot().controller.retry()}
          >
            {ti("purchases.retry")}
          </Button>
          {purchaseAnalysis.diagnostic.diagnostics?.map((diagnostic, index) => (
            <p className="muted small" key={index}>
              {enhancementDiagnosticText(diagnostic, ti)}
            </p>
          ))}
          {purchaseAnalysis.diagnostic.code === "purchaseEnhancementInvalid" &&
            purchaseAnalysis.diagnostic.params?.profile === itemVersion && (
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
    </>
  );
}
function ConnectedRunSetup(
  props: Omit<
    ComponentProps<typeof RunSetup>,
    | "request"
    | "resourceCount"
    | "actions"
    | "allowance"
    | "purchaseAnalysis"
    | "readinessError"
  > & { eligibilityError: ErrorDescriptor | null },
) {
  const snapshot = useGearLabSelector((state) => state.draft!.snapshot);
  const iterations = useGearLabSelector((state) => state.draft!.iterations);
  const resourceCount = useGearLabSelector(
    (state) => Object.keys(state.draft!.purchases?.balances ?? {}).length,
  );
  const hasPurchases = useGearLabSelector((state) => !!state.draft!.purchases);
  const request = useMemo(
    () => ({ snapshot, iterations }),
    [snapshot, iterations],
  );
  const actions = useGearLabSelector((state) => state.actions);
  const analysisSession = useAnalysisView();
  const ti = useTranslations("inventory"),
    td = useTranslations("diagnostics");
  const readinessError = props.eligibilityError;
  const enhancementAnalysis = analysisSession.nonPurchase?.enhancementAnalysis;
  return (
    <RunSetup
      {...props}
      request={request}
      resourceCount={resourceCount}
      actions={actions}
      allowance={analysisSession.nonPurchase?.allowance ?? null}
      purchaseAnalysis={hasPurchases ? analysisSession.view.state : undefined}
      readinessError={
        readinessError
          ? localizeDiagnostic(readinessError, td)
          : enhancementAnalysis?.complete &&
              enhancementAnalysis.validCount === 0
            ? ti("editor.noValidSets")
            : ""
      }
    />
  );
}
function ConnectedPurchases(
  props: Pick<
    ComponentProps<typeof PurchasableItemsDialog>,
    "open" | "onOpenChange"
  >,
) {
  const snapshot = useGearLabSelector((state) => state.draft!.snapshot);
  const purchases = useGearLabSelector((state) => state.draft!.purchases);
  const request = useMemo(
    () => ({ snapshot, purchases }),
    [snapshot, purchases],
  );
  const actions = useGearLabSelector((state) => state.actions);
  const analysis = useAnalysisView();
  return (
    <PurchasableItemsDialog
      {...props}
      request={request}
      actions={actions}
      preview={analysis.view.preview}
      analysisState={analysis.view.state}
    />
  );
}
function ConnectedGemming({ onClose }: { onClose: () => void }) {
  const snapshot = useGearLabSelector((state) => state.draft!.snapshot);
  const actions = useGearLabSelector((state) => state.actions);
  return (
    <GemmingPanel snapshot={snapshot} actions={actions} onClose={onClose} />
  );
}
function ConnectedSettings({ onClose }: { onClose: () => void }) {
  const snapshot = useGearLabSelector((state) => state.draft!.snapshot);
  const actions = useGearLabSelector((state) => state.actions);
  return (
    <PresetPanel
      snapshot={snapshot}
      onChange={({ specId, settings, provenance, professionLevels }) =>
        actions.applySettings({
          specId,
          settings,
          provenance,
          professionLevels,
        })
      }
      onClose={onClose}
    />
  );
}

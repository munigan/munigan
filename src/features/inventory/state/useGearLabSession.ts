"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  Snapshot,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import type { ImportPanelHandle } from "@/features/import/ImportPanel";
import { describeError, type ErrorDescriptor } from "@/i18n/error";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { validateItem } from "@/domain/equipment/validate";
import {
  draftKey,
  saveDraft,
  loadDraft,
  clearDraft,
  clearMatchingDraft,
} from "@/features/import/draft-store";
import { importFormDraftKey } from "@/features/import/import-form-draft";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";
import { loadAttempt } from "../admission-attempt";
import {
  createDraftPersistence,
  type DraftPersistence,
} from "./gear-lab-persistence";
import { useGearLabRuntime } from "./GearLabRuntime";

export function useGearLabSession({
  autoRestore,
  onStart,
}: {
  autoRestore: boolean;
  onStart: () => void;
}) {
  const runtime = useGearLabRuntime();
  const { store } = runtime;
  const actions = store.getState().actions;
  const [serverPolicy, setPolicy] = useState<WorkPolicy | null>(null);
  const [error, setError] = useState<ErrorDescriptor | null>(null);
  const [readinessError, setReadinessError] = useState<ErrorDescriptor | null>(
    null,
  );
  const [storageError, setStorageError] = useState<ErrorDescriptor | null>(
    null,
  );
  const [hasDraft, setHasDraft] = useState(false);
  const [replace, setReplace] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const reportStorageError = useCallback(
    (error: unknown) => setStorageError(describeError(error)),
    [],
  );
  const persistenceOwner = useRef<DraftPersistence | null>(null);
  // Consumers retain this handle while effect replay replaces its active owner.
  const persistence = useMemo<DraftPersistence>(
    () => ({
      flush: () => persistenceOwner.current?.flush(),
      cancel: () => persistenceOwner.current?.cancel(),
      discard: () => persistenceOwner.current?.discard(),
      complete: (submitted) => persistenceOwner.current?.complete(submitted),
      dispose: (options) => persistenceOwner.current?.dispose(options),
    }),
    [],
  );
  useEffect(
    () => runtime.session.setPolicy(serverPolicy),
    [runtime, serverPolicy],
  );
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
    persistenceOwner.current = owner;
    const flush = () => {
      try {
        owner.flush();
      } catch (error) {
        reportStorageError(error);
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      try {
        owner.dispose();
      } catch (error) {
        reportStorageError(error);
      }
      // Keep the disposed owner reachable for completion of already pending admission.
    };
  }, [store, reportStorageError]);
  useEffect(() => {
    let previousKey: readonly unknown[] = [];
    let previousExclusions:
      NonNullable<TopGearRequest["purchases"]>["excludedItemIds"] | undefined;
    let failed = false;
    const validateEligibility = () => {
      const { draft, epoch } = store.getState();
      const purchases = draft?.purchases;
      const overrides = purchases?.itemEnhancements;
      const key = [
        draft?.snapshot,
        epoch,
        overrides && Object.keys(overrides).length ? overrides : undefined,
        // Adding an ordinary wallet does not change snapshot eligibility.
        purchases?.recipeRevision ??
          (draft
            ? getPurchaseCatalog(itemVersionOf(draft.snapshot)).revision
            : undefined),
        // Selected custom rewards use purchase overrides instead of raw intent.
        // Their conversion can change without changing the snapshot itself.
        ...(purchases
          ? draft.snapshot.inventory
              .filter(
                (item) =>
                  item.source === "custom" &&
                  draft.selection.selectedInstanceIds.includes(item.instanceId),
              )
              .map((item) => item.instanceId)
          : []),
      ];
      const unchanged =
        key.length === previousKey.length &&
        key.every((value, index) => value === previousKey[index]);
      // Valid inclusion commands cannot add unknown IDs. A failed restored input
      // must still be rechecked when catalog repair removes invalid exclusions.
      const exclusionsUnchanged =
        !failed || previousExclusions === purchases?.excludedItemIds;
      previousKey = key;
      previousExclusions = purchases?.excludedItemIds;
      if (unchanged && exclusionsUnchanged) return;
      setError(null);
      try {
        // Preserve effective purchase/custom enhancement semantics at this boundary.
        // Precision, owned selection, balances and valid purchase exclusions use
        // the cached result; admission always validates the complete current draft.
        if (draft) validateRequest(encodeRequest(draft));
        failed = false;
        setReadinessError(null);
      } catch (error) {
        failed = true;
        setReadinessError(describeError(error));
      }
    };
    validateEligibility();
    return store.subscribe(validateEligibility);
  }, [store]);
  const importPanel = useRef<ImportPanelHandle>(null);
  const [importRevision, setImportRevision] = useState(0);
  const [selectionVisit, setSelectionVisit] = useState({
    revision: 0,
  });
  function restoreSelection(draft: TopGearRequest) {
    setSelectionVisit((visit) => ({
      revision: visit.revision + 1,
    }));
    persistence.cancel();
    actions.replaceDraft(draft);
  }
  const returnToStart = useEffectEvent((event: Event) => {
    try {
      persistence.flush();
      importPanel.current?.saveForLater();
      const saved = !!(
        localStorage.getItem(importFormDraftKey) ||
        localStorage.getItem(draftKey)
      );
      actions.replaceDraft(null);
      setReplace(false);
      onStart();
      setRestoring(false);
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
      const recoveredAttempt = loadAttempt();
      const returning =
        sessionStorage.getItem("munigan.top-gear.signin-restore") === "1";
      if (!autoRestore && !returning && !recoveredAttempt) return;
    } catch (e) {
      queueMicrotask(() => {
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
    try {
      setSelectionVisit((visit) => ({
        revision: visit.revision + 1,
      }));
      persistence.flush();
      actions.replaceDraft({
        tool: "top-gear",
        precision: "standard",
        snapshot,
        selection: {
          selectedInstanceIds: snapshot.inventory
            .filter(
              (i) =>
                i.source === "equipped" &&
                validateItem(snapshot, i).length === 0,
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
    } catch (error) {
      reportStorageError(error);
    }
  }
  function signInForRun() {
    try {
      persistence.flush();
      sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
      setSignInOpen(true);
    } catch (e) {
      setStorageError(describeError(e));
    }
  }
  const openImport = useCallback(() => {
    try {
      persistence.flush();
      setReplace(true);
    } catch (error) {
      reportStorageError(error);
    }
  }, [persistence, reportStorageError]);
  function restoreSavedDraft() {
    try {
      if (importPanel.current?.restoreDraft()) {
        setHasDraft(false);
        return;
      }
      const draft = loadDraft();
      if (draft) restoreSelection(draft);
    } catch (error) {
      setError(describeError(error));
    }
  }
  function discardSavedDraft() {
    try {
      persistence.discard();
      setHasDraft(false);
    } catch {
      reportStorageError("Could not clear local storage");
    }
  }
  return {
    policy: serverPolicy,
    persistence,
    reportStorageError,
    error,
    readinessError,
    storageError,
    hasDraft,
    replace,
    setReplace,
    signInOpen,
    setSignInOpen,
    importPanel: importPanel as RefObject<ImportPanelHandle | null>,
    importRevision,
    selectionRevision: selectionVisit.revision,
    restoring,
    resolved,
    signInForRun,
    openImport,
    restoreSavedDraft,
    discardSavedDraft,
  };
}

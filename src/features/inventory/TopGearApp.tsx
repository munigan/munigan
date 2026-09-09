"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  Snapshot,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import { ImportPanel } from "@/features/import/ImportPanel";
import { InventorySelector } from "./InventorySelector";
import { PresetPanel } from "@/features/settings/PresetPanel";
import { ItemVersionContext } from "./ItemVersionContext";
import { GemmingPanel, EnhancementSummary } from "./GemmingPanel";
import { defaultGemming } from "@/domain/equipment/gemming";
import {
  itemVersions,
  itemVersionOf,
  type ItemVersion,
} from "@/domain/top-gear/item-version";
import { getSpec } from "@/features/settings/registry";
import { validateItem } from "@/domain/equipment/validate";
import { estimateAllowance } from "@/domain/equipment/enumerate";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import {
  draftKey,
  saveDraft,
  loadDraft,
  clearDraft,
} from "@/features/import/draft-store";
export function TopGearApp() {
  const router = useRouter();
  const [request, setRequest] = useState<TopGearRequest | null>(null),
    [policy, setPolicy] = useState<WorkPolicy | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [enhancementsOpen, setEnhancementsOpen] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [hasDraft, setHasDraft] = useState(false),
    [replace, setReplace] = useState(false),
    [storageError, setStorageError] = useState("");
  const intent = useRef<string>("");
  useEffect(() => {
    fetch("/api/top-gear/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.policy) setPolicy(d.policy);
        else setError(d.error);
        try {
          setHasDraft(!!localStorage.getItem(draftKey));
        } catch {
          setStorageError(
            "Local draft storage is unavailable in this browser.",
          );
        }
      })
      .catch(() =>
        setError(
          "Could not connect to the simulation service. Reload to try again.",
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
        lockedSlots: Object.fromEntries(
          Object.entries(next.selection.lockedSlots).filter(
            ([, id]) => !id || !excluded.includes(id),
          ),
        ),
      },
    };
    setRequest(next);
    intent.current = "";
    setError("");
    try {
      saveDraft(next);
      setHasDraft(true);
    } catch {
      setStorageError(
        "Your selection is kept on this page, but could not be saved in this browser.",
      );
    }
  }
  function resolved(snapshot: Snapshot) {
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
  async function run() {
    if (!request) return;
    setPending(true);
    try {
      validateRequest(encodeRequest(request));
      if (!intent.current) intent.current = crypto.randomUUID();
      const response = await fetch("/api/top-gear/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": intent.current,
        },
        body: JSON.stringify(encodeRequest(request)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(data.reportUrl);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }
  const allowance =
    request && policy
      ? estimateAllowance(request.snapshot, request.selection, policy)
      : null;
  const readinessError = useMemo(() => {
    if (!request) return "";
    try {
      validateRequest(encodeRequest(request));
      return "";
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Review your simulation settings.";
    }
  }, [request]);
  const spec = request ? getSpec(request.snapshot.specId) : null;
  return (
    <ItemVersionContext.Provider
      value={request ? itemVersionOf(request.snapshot) : "original"}
    >
      <section id="content">
        <div className="page-heading">
          <h1>TOP GEAR</h1>
          <p>
            {request
              ? "Select items. Compare sets."
              : "Import your character. Find your best set."}
          </p>
          {request && (
            <button
              className="text-button heading-action"
              onClick={() => setReplace(true)}
            >
              Import character ↗
            </button>
          )}
        </div>
        {!request ? (
          <>
            {hasDraft && (
              <div className="notice resume-draft">
                <span>You have a saved Top Gear selection.</span>
                <button
                  onClick={() => {
                    try {
                      const draft = loadDraft();
                      if (draft) change(draft);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Restore draft
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      clearDraft();
                      setHasDraft(false);
                    } catch {
                      setStorageError("Could not clear local storage");
                    }
                  }}
                >
                  Discard
                </button>
              </div>
            )}
            <ImportPanel onResolved={resolved} />
          </>
        ) : replace ? (
          <>
            <div className="notice">
              Importing replaces this local selection. Previous reports stay
              available.{" "}
              <button onClick={() => setReplace(false)}>
                Keep current character
              </button>
            </div>
            <ImportPanel onResolved={resolved} />
          </>
        ) : (
          <div className="gear-layout">
            <InventorySelector request={request} onChange={change} />
            <aside className="run-summary panel" aria-label="Simulation setup">
              <div className="run-configuration">
                <div className="run-character section-top">
                  <div>
                    <h2>
                      {request.snapshot.settings.player!.name ||
                        "Your character"}
                    </h2>
                    <p className="muted small">
                      {spec!.name} {spec!.className} · 80
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setReplace(true)}
                  >
                    Edit
                  </button>
                </div>
                <label className="item-version-select">
                  Item version
                  <select
                    aria-label="Item version"
                    value={itemVersionOf(request.snapshot)}
                    onChange={(event) => {
                      const itemVersion = event.target.value as ItemVersion;
                      change({
                        ...request,
                        snapshot: {
                          ...request.snapshot,
                          itemVersion,
                          itemDataRevision: itemVersions[itemVersion].revision,
                          provenance: {
                            ...request.snapshot.provenance,
                            itemVersion: "edited",
                          },
                        },
                      });
                    }}
                  >
                    {Object.entries(itemVersions).map(([id, profile]) => (
                      <option key={id} value={id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="simulation-settings-summary">
                  <div className="section-top">
                    <span className="run-section-label">Simulation</span>
                    <button
                      className="text-button"
                      onClick={() => setSettingsOpen(true)}
                      aria-haspopup="dialog"
                    >
                      Buffs & settings <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  <p className="simulation-description">
                    {request.snapshot.settings.encounter!.targets.length === 1
                      ? "Single target"
                      : `${request.snapshot.settings.encounter!.targets.length} targets`}{" "}
                    · {request.snapshot.settings.encounter!.duration}s
                  </p>
                </div>
                <EnhancementSummary
                  snapshot={request.snapshot}
                  onOpen={() => setEnhancementsOpen(true)}
                />
                <details className="allowance-help">
                  <summary>About the set limit</summary>
                  <p>
                    {allowance?.units.toLocaleString() ?? "—"} /{" "}
                    {policy?.maxUnits.toLocaleString() ?? "—"} work units
                  </p>
                  <p>
                    Upper bound, including equipped gear once. Illegal or
                    identical combinations are removed by the worker. Each
                    admitted set receives{" "}
                    {policy?.iterationsPerSet.toLocaleString()} simulation
                    iterations.
                  </p>
                </details>
              </div>
              <div
                className="run-action"
                data-over-limit={allowance ? !allowance.allowed : false}
              >
                <div
                  className="run-budget"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="section-top">
                    <span className="set-count">
                      {allowance ? (
                        <>
                          <strong>
                            {Math.min(allowance.count, 999999).toLocaleString()}
                          </strong>{" "}
                          /{" "}
                          {Math.floor(
                            policy!.maxUnits / policy!.unitsPerSet,
                          ).toLocaleString()}{" "}
                          sets
                        </>
                      ) : (
                        "Loading allowance…"
                      )}
                    </span>
                    <span className="badge">Free</span>
                  </div>
                  <progress
                    aria-label="Free work allowance"
                    max={policy?.maxUnits ?? 1}
                    value={Math.min(
                      allowance?.units ?? 0,
                      policy?.maxUnits ?? 1,
                    )}
                  />
                </div>
                {(error ||
                  readinessError ||
                  (allowance && !allowance.allowed)) && (
                  <div className="run-feedback" role="alert">
                    {error ||
                      readinessError ||
                      "Select fewer items to stay within the free set limit."}
                  </div>
                )}
                <button
                  className="primary run-button"
                  disabled={pending || !allowance?.allowed || !!readinessError}
                  onClick={run}
                >
                  {pending ? "Submitting…" : "Find Top Gear"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
                <p className="muted small run-caption">
                  {request.snapshot.inventory.some((i) => i.source === "bag")
                    ? "Equipped + carried bags"
                    : "Equipped only · no bags imported"}
                </p>
              </div>
            </aside>
          </div>
        )}
        {error && (!request || replace) && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {storageError && (
          <p role="status" className="notice">
            {storageError}
          </p>
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

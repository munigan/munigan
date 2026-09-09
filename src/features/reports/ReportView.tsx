"use client";
import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type {
  TopGearReport,
  SetRow,
  Loadout,
  Snapshot,
  Slot,
  ItemInstance,
} from "@/domain/top-gear/model";
import {
  decodeSnapshot,
  encodeSnapshot,
} from "@/domain/top-gear/request-schema";
import { slots, slotNames } from "@/domain/top-gear/slots";
import { changedSlots, changedResultSlots } from "@/domain/top-gear/report";
import { withEnhancements } from "@/domain/equipment/enhancements";
import { alignPairedSlots } from "@/domain/equipment/enumerate";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
import { itemVersions, itemVersionOf } from "@/domain/top-gear/item-version";
import { getCatalog } from "@/domain/equipment/catalog";
import { getSpec } from "@/features/settings/registry";
import {
  ItemIcon,
  ItemName,
  ItemDetails,
  ItemLink,
} from "@/features/inventory/Item";
import { saveDraft } from "@/features/import/draft-store";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import { Stat } from "@/generated/wotlk/common";
import { useReport } from "./use-report";
import "./report-refinements.css";

const mobileQuery = "(max-width: 767px)";
function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;
const serverViewport = () => false;
type ReportResponse = {
  jobId: string;
  report: Omit<TopGearReport, "snapshot"> & {
    snapshot: ReturnType<typeof encodeSnapshot>;
  };
  canManage: boolean;
  error: string | null;
  pinnedRows: SetRow[];
  totalRows: number;
  nextCursor: number | null;
};
const number = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const signed = (n: number | null) =>
  n === null ? "—" : `${n > 0 ? "+" : ""}${number(n)}`;
const compactSlotNames: Record<Slot, string> = {
  ...slotNames,
  shoulder: "Shldr",
  finger1: "Ring1",
  finger2: "Ring2",
  trinket1: "Trink1",
  trinket2: "Trink2",
  mainHand: "MHand",
  offHand: "OHand",
  ranged: "Range",
};
function DpsChange({
  gain,
  percent,
  cell = false,
}: {
  gain: number | null;
  percent: number | null;
  cell?: boolean;
}) {
  const direction =
    gain === null || gain === 0 ? "neutral" : gain > 0 ? "up" : "down";
  return (
    <span
      className={`dps-change dps-change--${direction}`}
      role={cell ? "cell" : undefined}
    >
      <span className="dps-change-value">
        <svg
          className="dps-change-icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            d={
              direction === "up"
                ? "M8 13V3m-4 4 4-4 4 4"
                : direction === "down"
                  ? "M8 3v10m-4-4 4 4 4-4"
                  : "M4 8h8"
            }
          />
        </svg>
        <span className="sr-only">
          {gain === null
            ? "DPS comparison unavailable: "
            : direction === "up"
              ? "DPS gain: "
              : direction === "down"
                ? "DPS loss: "
                : "No DPS change: "}
        </span>
        {signed(gain)}
      </span>
      {percent !== null && (
        <small className="dps-change-percent">
          {percent > 0 ? "+" : ""}
          {percent.toFixed(2)}%
        </small>
      )}
    </span>
  );
}
export function ReportView({ token }: { token: string }) {
  const router = useRouter(),
    [actionError, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [difference, setDifference] = useState<"equipped" | "highest">("equipped"),
    [preview, setPreview] = useState<"changes" | "full" | null>(null),
    [cursor, setCursor] = useState(0),
    [full, setFull] = useState(false),
    [preferFewer, setPreferFewer] = useState(true),
    [busy, setBusy] = useState(false),
    [reuse, setReuse] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeToViewport,
    isMobileViewport,
    serverViewport,
  );
  const changesOnly = (preview ?? (mobile ? "changes" : "full")) === "changes";
  const retryIntent = useRef({ jobId: "", key: "" });
  const { data, error: refreshError } = useReport<ReportResponse>(
    `/api/reports/${token}?cursor=${cursor}`,
  );
  const error = actionError || refreshError;
  const snapshot = data ? decodeSnapshot(data.report.snapshot) : null,
    report = data?.report;
  const rows = data
    ? [
        ...new Map(
          [...data.pinnedRows, ...data.report.rows].map((r) => [r.id, r]),
        ).values(),
      ]
    : [];
  const selected =
    rows.find((r) => r.id === selectedId) ??
    rows.find((r) => r.id === report?.highestId) ??
    rows[0];
  const highest = rows.find((r) => r.id === report?.highestId);
  const base =
    difference === "highest" && highest ? highest.loadout : snapshot?.equipped;
  const baseGems = difference === "highest" ? highest?.gemOverrides : undefined;
  const baseEnchants =
    difference === "highest" ? highest?.enchantOverrides : undefined;
  const selectedSnapshot =
    snapshot && selected
      ? withEnhancements(
          snapshot,
          selected.gemOverrides,
          selected.enchantOverrides,
        )
      : snapshot;
  const selectedChanges =
    snapshot && selected && base
      ? changedResultSlots(
          snapshot,
          base,
          selected.loadout,
          baseGems,
          selected.gemOverrides,
          baseEnchants,
          selected.enchantOverrides,
        )
      : [];
  const requiredChanges =
    snapshot && selected
      ? changedResultSlots(
          snapshot,
          snapshot.equipped,
          selected.loadout,
          undefined,
          selected.gemOverrides,
          undefined,
          selected.enchantOverrides,
        ).length
      : 0;
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setError("Clipboard access failed. Use your browser’s copy action.");
    }
  }
  async function management(action: "cancel" | "retry") {
    if (!data) return;
    setBusy(true);
    try {
      if (retryIntent.current.jobId !== data.jobId)
        retryIntent.current = { jobId: data.jobId, key: crypto.randomUUID() };
      const r = await fetch(`/api/top-gear/jobs/${data.jobId}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": retryIntent.current.key,
        },
        body: "{}",
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      if (action === "retry") router.push(result.reportUrl);
      else
        setNotice(
          "Cancellation requested. Completed sets will stay available.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(useSelected = false) {
    if (!snapshot || !report || !selected) return;
    try {
      let next = structuredClone(useSelected ? selectedSnapshot! : snapshot);
      if (useSelected) {
        next = {
          ...next,
          id: crypto.randomUUID(),
          equipped: { ...selected.loadout },
          inventory: next.inventory.map((i) => {
            const slot = slots.find(
              (s) => selected.loadout[s] === i.instanceId,
            );
            return {
              ...i,
              source: slot ? "equipped" : "bag",
              equippedSlot: slot,
            };
          }),
        };
        next.settings = IndividualSimSettings.clone(snapshot.settings);
      }
      saveDraft({
        tool: "top-gear",
        precision: "standard",
        snapshot: next,
        selection: report.selection,
      });
      router.push("/top-gear");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data || !snapshot || !report)
    return (
      <section id="content" className="report-view">
        <div className="page-heading">
          <h1>TOP GEAR</h1>
        </div>
        <div
          className={`panel report-state ${error ? "report-state--failed" : "report-state--loading"}`}
          role={error ? "alert" : "status"}
          aria-busy={!error}
        >
          <p className="eyebrow">
            {error ? "REPORT UNAVAILABLE" : "TOP GEAR REPORT"}
          </p>
          <h2>
            {error ? "Could not load this report" : "Loading your report…"}
          </h2>
          {error ? (
            <p>{error}</p>
          ) : (
            <div className="report-loading-bar" aria-hidden="true" />
          )}
        </div>
        <p className="actions">
          <a href="/top-gear">Back to Top Gear</a>
        </p>
      </section>
    );
  const active = report.status === "queued" || report.status === "running",
    spec = getSpec(snapshot.specId);
  return (
    <ItemVersionContext.Provider value={itemVersionOf(snapshot)}>
      <section id="content" className="report-view">
        <div className="page-heading">
          <h1>TOP GEAR</h1>
          <p>
            {snapshot.settings.player!.name} · {spec.name} {spec.className} · 80
            <span className="report-item-version">
              {itemVersions[itemVersionOf(snapshot)].label}
            </span>
          </p>
          <div className="heading-action actions">
            <button
              onClick={() =>
                copy(
                  location.href,
                  "Report link copied. Anyone with the link can view this report.",
                )
              }
            >
              Share ↗
            </button>
            <button className="primary" onClick={() => edit()}>
              Edit & run again
            </button>
          </div>
        </div>
        {active && (
          <div
            className={`panel job-progress report-state report-state--${report.status}`}
            role="status"
          >
            <div className="section-top">
              <div>
                <p className="eyebrow">
                  {report.status === "queued"
                    ? "WAITING FOR A WORKER"
                    : "SIMULATING YOUR GEAR"}
                </p>
                <h2>
                  {report.status === "queued"
                    ? "Your run is in the queue"
                    : report.phase === "equipped"
                      ? "Simulating equipped gear"
                      : "Comparing complete combinations"}
                </h2>
              </div>
              <span className="badge">
                {report.coverage.succeeded} / {report.coverage.planned ?? "—"}{" "}
                sets
              </span>
            </div>
            <progress
              aria-label="Simulation progress"
              value={
                report.status === "queued" || report.coverage.planned === null
                  ? undefined
                  : report.coverage.succeeded
              }
              max={Math.max(1, report.coverage.planned ?? 1)}
            />
            <p className="muted">
              You can leave this page and return using this report link.
            </p>
            {data.canManage && (
              <button disabled={busy} onClick={() => management("cancel")}>
                Cancel run
              </button>
            )}
          </div>
        )}
        {!active && report.status !== "complete" && (
          <div
            className={`notice report-state report-state--${report.status}`}
            role="status"
          >
            <p className="eyebrow">
              {report.coverage.succeeded
                ? "SAVED RESULTS"
                : "SIMULATION STOPPED"}
            </p>
            <h2>
              {report.status === "canceled"
                ? "Run canceled"
                : report.status === "partial"
                  ? "Partial results"
                  : "This run could not finish"}
            </h2>
            <p>
              {report.termination === "runtime-limit"
                ? "The runtime limit was reached."
                : (data.error ??
                  "Completed combinations are retained below.")}{" "}
              {report.coverage.succeeded} of{" "}
              {report.coverage.planned ?? "unknown"} sets evaluated.
            </p>
            {data.canManage && (
              <button disabled={busy} onClick={() => management("retry")}>
                Retry unfinished work
              </button>
            )}
          </div>
        )}
        {selected && base && (
          <>
            <div className="panel selected-set">
              <div className="section-top">
                <div>
                  <p className="eyebrow">
                    VIEWING{" "}
                    {selected.isEquipped
                      ? "EQUIPPED GEAR"
                      : selected.id === report.highestId
                        ? report.coverage.exhaustive
                          ? "HIGHEST DPS"
                          : "BEST FOUND"
                        : "SELECTED COMBINATION"}
                    {!selected.eligible ? " · REFERENCE ONLY" : ""}
                  </p>
                  <div className="dps-heading">
                    <strong>{number(selected.dps)} DPS</strong>
                    <DpsChange
                      gain={selected.gain}
                      percent={selected.percent}
                    />
                    <span className="muted">vs. equipped</span>
                  </div>
                </div>
                <div className="text-actions">
                  <button onClick={() => setFull(true)}>
                    Full gear details ↗
                  </button>
                  <button
                    onClick={() =>
                      copy(
                        JSON.stringify(
                          {
                            items: slots.map((slot) => {
                              const i = selectedSnapshot!.inventory.find(
                                (i) => i.instanceId === selected.loadout[slot],
                              );
                              return {
                                id: i?.itemId ?? 0,
                                enchant: i?.enchantId ?? 0,
                                gems: i?.gemIds ?? [],
                              };
                            }),
                          },
                          null,
                          2,
                        ),
                        "Gear set copied as simulator equipment JSON.",
                      )
                    }
                  >
                    Copy set
                  </button>
                </div>
              </div>
              <div className="report-preview-controls">
                <span className="required-changes">
                  {requiredChanges} required{" "}
                  {requiredChanges === 1 ? "change" : "changes"} vs. equipped
                </span>
                <div
                  className="report-segmented"
                  role="group"
                  aria-label="Gear preview"
                >
                  <button
                    aria-pressed={changesOnly}
                    onClick={() => setPreview("changes")}
                  >
                    Changes
                  </button>
                  <button
                    aria-pressed={!changesOnly}
                    onClick={() => setPreview("full")}
                  >
                    Full set
                  </button>
                </div>
              </div>
              <GearStrip
                snapshot={selectedSnapshot!}
                loadout={selected.loadout}
                base={base}
                changes={selectedChanges}
                changesOnly={changesOnly}
                emptyLabel={
                  difference === "highest"
                    ? "Matches the top set"
                    : "No changes from equipped"
                }
              />
              <div className="section-top muted small">
                <span className="gain">
                  {selectedChanges.length} highlighted vs.{" "}
                  {difference === "highest" ? "top set" : "equipped"}
                </span>
                <span>
                  {[
                    Object.keys(selected.gemOverrides ?? {}).length
                      ? `${Object.keys(selected.gemOverrides!).length} ${Object.keys(selected.gemOverrides!).length === 1 ? "item" : "items"} regemmed`
                      : "",
                    Object.keys(selected.enchantOverrides ?? {}).length
                      ? `${Object.keys(selected.enchantOverrides!).length} ${Object.keys(selected.enchantOverrides!).length === 1 ? "item" : "items"} enchanted`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Original gems & enchants"}
                </span>
              </div>
              {[
                ...(selected.gemWarnings ?? []),
                ...(selected.enchantWarnings ?? []),
              ].map((warning) => (
                <p className="notice small" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
            <div className="combinations-heading section-top">
              <h2>
                Gear combinations{" "}
                <span className="muted small">
                  {report.coverage.succeeded} tested
                </span>
              </h2>
              <div className="difference-controls">
                <span className="muted">Differences from</span>
                <div
                  className="report-segmented"
                  role="radiogroup"
                  aria-label="Item differences from"
                >
                  <label>
                    <input
                      type="radio"
                      name="difference"
                      checked={difference === "equipped"}
                      onChange={() => setDifference("equipped")}
                    />
                    <span>Equipped</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="difference"
                      checked={difference === "highest"}
                      onChange={() => setDifference("highest")}
                    />
                    <span>Top set</span>
                  </label>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSelectedId(report.equippedId)}
                >
                  View equipped ↓
                </button>
              </div>
            </div>
            <div
              className="combination-table"
              role="table"
              aria-label="Ranked gear combinations"
            >
              <div className="combination-columns table-heading" role="row">
                <span role="columnheader">SET</span>
                <span role="columnheader">ITEMS & ENHANCEMENTS</span>
                <span role="columnheader">DPS</span>
                <span role="columnheader">GAIN VS. EQUIPPED</span>
              </div>
              {report.rows.map((row, index) => {
                const loadout = alignPairedSlots(snapshot, row.loadout, base);
                const rowSnapshot = withEnhancements(
                  snapshot,
                  row.gemOverrides,
                  row.enchantOverrides,
                );
                const changes = changedResultSlots(
                  snapshot,
                  base,
                  loadout,
                  baseGems,
                  row.gemOverrides,
                  baseEnchants,
                  row.enchantOverrides,
                );
                return (
                  <div
                    key={row.id}
                    role="row"
                    className={`combination-columns combination-row ${row.isEquipped ? "equipped-row" : ""} ${row.id === selected.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="set-number" role="cell">
                      <button
                        className="set-select"
                        aria-label={`View ${row.isEquipped ? "equipped gear" : `set ${cursor + index + 1}`}, ${number(row.dps)} DPS`}
                        aria-pressed={row.id === selected.id}
                      >
                        {String(cursor + index + 1).padStart(2, "0")}
                      </button>
                    </span>
                    <span className="set-changes" role="cell">
                      <span className="changed-icons">
                        {changes.slice(0, 5).map((slot) => {
                          const i = rowSnapshot.inventory.find(
                            (i) => i.instanceId === loadout[slot],
                          );
                          return (
                            <span
                              key={slot}
                              title={`${slotNames[slot]}: ${i ? getCatalog(snapshot.itemVersion).items.get(i.itemId)?.name : "Empty"}`}
                            >
                              {i ? (
                                <ItemIcon
                                  item={i}
                                  size={40}
                                  aria-label={
                                    getCatalog(snapshot.itemVersion).items.get(
                                      i.itemId,
                                    )?.name
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                />
                              ) : (
                                <span className="empty-icon">—</span>
                              )}
                              <small>{compactSlotNames[slot]}</small>
                            </span>
                          );
                        })}
                        {changes.length > 5 && (
                          <span className="muted">+{changes.length - 5}</span>
                        )}
                      </span>
                      <span className="report-row-badges">
                        {row.isEquipped && (
                          <span className="badge equipped-badge">Equipped</span>
                        )}
                        {row.id === report.highestId && (
                          <span className="badge highest-badge">
                            {report.coverage.exhaustive
                              ? "Highest DPS"
                              : "Best found"}
                          </span>
                        )}
                        {row.tiedToHighest && row.id !== report.highestId && (
                          <span
                            className="badge tied-badge"
                            aria-describedby="report-tie-explanation"
                          >
                            Tied
                          </span>
                        )}
                        {row.id === report.recommendedId &&
                          preferFewer &&
                          row.id !== report.highestId && (
                            <span className="report-fewer-swaps">
                              Fewer swaps
                            </span>
                          )}
                        {!row.eligible && (
                          <span className="muted">Reference only</span>
                        )}
                      </span>
                    </span>
                    <strong role="cell">{number(row.dps)}</strong>
                    <DpsChange gain={row.gain} percent={row.percent} cell />
                  </div>
                );
              })}
            </div>
            <div className="section-top report-controls">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={preferFewer}
                  onChange={(e) => setPreferFewer(e.target.checked)}
                />{" "}
                Prefer fewer swaps when tied
              </label>
              <div className="actions">
                <button
                  disabled={cursor === 0}
                  onClick={() => setCursor(Math.max(0, cursor - 20))}
                >
                  Previous
                </button>
                <span className="muted">
                  {cursor + 1}–{cursor + report.rows.length} of {data.totalRows}
                </span>
                <button
                  disabled={data.nextCursor === null}
                  onClick={() => setCursor(data.nextCursor!)}
                >
                  Next
                </button>
              </div>
            </div>
            <p
              id="report-tie-explanation"
              className="muted small uncertainty-note"
            >
              “Tied” means the difference is within pairwise sampling
              uncertainty. It does not guarantee the same DPS. Numeric ranking
              stays unchanged.
            </p>
            <button className="text-button" onClick={() => setReuse(true)}>
              Use selected set as a new equipped reference →
            </button>
            {reuse && (
              <div className="notice">
                <p>
                  This creates a new local Top Gear draft using the selected set
                  as equipped. All owned items remain available and this report
                  stays unchanged.
                </p>
                <div className="actions">
                  <button onClick={() => setReuse(false)}>
                    Keep current reference
                  </button>
                  <button onClick={() => edit(true)}>Create new draft</button>
                </div>
              </div>
            )}
          </>
        )}
        <details className="simulation-details">
          <summary>Simulation details</summary>
          <p>
            {report.policy.iterationsPerSet} actual iterations per set · Uniform
            sampling ·{" "}
            {report.coverage.exhaustive
              ? "All admitted combinations evaluated"
              : "Coverage incomplete"}
          </p>
          <p>
            {report.coverage.failed} failed sets · {report.coverage.returned}{" "}
            results retained · Expires{" "}
            {new Date(report.expiresAt).toLocaleDateString()}
          </p>
          <p>
            Engine {snapshot.versions.engine.slice(0, 12)} · Item data{" "}
            {snapshot.itemDataRevision} ·{" "}
            {snapshot.settings.encounter!.duration}s ·{" "}
            {snapshot.settings.encounter!.targets.length} target(s)
          </p>
        </details>
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {refreshError
              ? `Showing the last received results. ${error}`
              : error}
          </p>
        )}
        {full && selected && (
          <FullSet
            snapshot={selectedSnapshot!}
            row={selected}
            onClose={() => setFull(false)}
          />
        )}
      </section>
    </ItemVersionContext.Provider>
  );
}
function GearStrip({
  snapshot,
  loadout,
  base,
  changes,
  changesOnly = false,
  emptyLabel,
}: {
  snapshot: Snapshot;
  loadout: Loadout;
  base: Loadout;
  changes?: ReturnType<typeof changedSlots>;
  changesOnly?: boolean;
  emptyLabel?: string;
}) {
  const aligned = alignPairedSlots(snapshot, loadout, base);
  const changed = changes ?? changedSlots(snapshot, base, aligned);
  return (
    <div
      className={`gear-strip ${changesOnly ? "gear-strip--changes" : ""}`}
      aria-label={
        changesOnly ? "Changed gear slots" : "Complete 17-slot gear set"
      }
    >
      {changesOnly && changed.length === 0 && (
        <p className="report-zero-changes">{emptyLabel}</p>
      )}
      {(changesOnly ? changed : slots).map((slot) => {
        const item = snapshot.inventory.find(
          (i) => i.instanceId === aligned[slot],
        );
        return (
          <div
            key={slot}
            className={
              changed.includes(slot) ? "gear-slot changed" : "gear-slot"
            }
            title={
              item
                ? getCatalog(snapshot.itemVersion).items.get(item.itemId)?.name
                : "Empty"
            }
          >
            <span>{slotNames[slot]}</span>
            {item ? (
              <ItemIcon
                item={item}
                aria-label={
                  getCatalog(snapshot.itemVersion).items.get(item.itemId)?.name
                }
              />
            ) : (
              <span className="empty-icon">—</span>
            )}
            <small>
              {item
                ? getCatalog(snapshot.itemVersion).items.get(item.itemId)?.ilvl
                : "Empty"}
            </small>
          </div>
        );
      })}
    </div>
  );
}
function FullSet({
  snapshot,
  row,
  onClose,
}: {
  snapshot: Snapshot;
  row: SetRow;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog full-set-dialog"
      aria-labelledby="full-gear-title"
      onCancel={onClose}
    >
      <div className="section-top full-set-header">
        <h2 id="full-gear-title">Full gear · {number(row.dps)} DPS</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="full-gear-list">
        {slots.map((slot) => {
          const item = snapshot.inventory.find(
            (i) => i.instanceId === row.loadout[slot],
          );
          return (
            <div key={slot} className="full-gear-row">
              <span className="muted">{slotNames[slot]}</span>
              {item ? (
                <>
                  <ItemIcon
                    item={item}
                    aria-label={
                      getCatalog(snapshot.itemVersion).items.get(item.itemId)
                        ?.name
                    }
                  />
                  <div className="full-gear-description">
                    <ItemLink item={item}>
                      <ItemName item={item} />
                    </ItemLink>
                    <FullSetEnhancements item={item} snapshot={snapshot} />
                    <ItemDetails item={item} />
                  </div>
                </>
              ) : (
                <span className="muted">Empty</span>
              )}
            </div>
          );
        })}
      </div>
      <details>
        <summary>Character stats from the simulator</summary>
        <dl className="stat-grid">
          {row.stats?.map((value, i) =>
            value !== 0 ? (
              <div key={i}>
                <dt>
                  {(Stat[i] ?? String(i))
                    .replace(/^Stat/, "")
                    .replace(/([a-z])([A-Z])/g, "$1 $2")}
                </dt>
                <dd>{number(value)}</dd>
              </div>
            ) : null,
          )}
        </dl>
      </details>
    </dialog>
  );
}

function FullSetEnhancements({
  item,
  snapshot,
}: {
  item: ItemInstance;
  snapshot: Snapshot;
}) {
  const catalog = getCatalog(snapshot.itemVersion);
  return (
    <div className="full-gear-enhancements">
      <span className="full-gear-enchant">
        Enchant:{" "}
        {item.enchantId
          ? (catalog.enchants.get(item.enchantId)?.[0]?.name ??
            `#${item.enchantId}`)
          : "None"}
      </span>
      {item.gemIds.length > 0 && (
        <span className="full-gear-gems" aria-label="Gems">
          {item.gemIds.map((id, index) =>
            id ? (
              <ItemIcon
                key={index}
                size={18}
                item={{
                  instanceId: `${item.instanceId}-gem-${index}`,
                  itemId: id,
                  gemIds: [],
                  enchantId: 0,
                  source: item.source,
                }}
              >
                <span>{catalog.gems.get(id)?.name ?? `Gem ${id}`}</span>
              </ItemIcon>
            ) : (
              <span className="muted" key={index}>
                Empty socket
              </span>
            ),
          )}
        </span>
      )}
    </div>
  );
}

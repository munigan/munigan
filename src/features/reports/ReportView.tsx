"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  TopGearReport,
  SetRow,
  Loadout,
  Snapshot,
} from "@/domain/top-gear/model";
import {
  decodeSnapshot,
  encodeSnapshot,
} from "@/domain/top-gear/request-schema";
import { slots, slotNames } from "@/domain/top-gear/slots";
import { changedSlots } from "@/domain/top-gear/report";
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
export function ReportView({ token }: { token: string }) {
  const router = useRouter(),
    [actionError, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [difference, setDifference] = useState<"equipped" | "highest">("equipped"),
    [cursor, setCursor] = useState(0),
    [full, setFull] = useState(false),
    [preferFewer, setPreferFewer] = useState(true),
    [busy, setBusy] = useState(false),
    [reuse, setReuse] = useState(false);
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
      let next = structuredClone(snapshot);
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
      <section id="content">
        <div className="page-heading">
          <h1>TOP GEAR</h1>
        </div>
        <div className="panel" role="status">
          {error || "Loading your report…"}
        </div>
        <p className="actions">
          <a href="/top-gear">Back to Top Gear</a>
        </p>
      </section>
    );
  const active = report.status === "queued" || report.status === "running",
    spec = getSpec(snapshot.specId);
  return (
    <section id="content">
      <div className="page-heading">
        <h1>TOP GEAR</h1>
        <p>
          {snapshot.settings.player!.name} · {spec.name} {spec.className} · 80
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
        <div className="panel job-progress">
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
            value={report.coverage.succeeded}
            max={report.coverage.planned ?? 1}
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
        <div className="notice">
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
                  <span className="gain">
                    {signed(selected.gain)}
                    {selected.percent !== null
                      ? ` · ${selected.percent.toFixed(2)}%`
                      : ""}
                  </span>
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
                            const i = snapshot.inventory.find(
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
            <GearStrip
              snapshot={snapshot}
              loadout={selected.loadout}
              base={base}
            />
            <div className="section-top muted small">
              <span className="gain">
                {changedSlots(snapshot, base, selected.loadout).length} changes
                highlighted
              </span>
              <span>Original gems & enchants</span>
            </div>
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
              <label>
                <input
                  type="radio"
                  name="difference"
                  checked={difference === "equipped"}
                  onChange={() => setDifference("equipped")}
                />{" "}
                Equipped
              </label>
              <label>
                <input
                  type="radio"
                  name="difference"
                  checked={difference === "highest"}
                  onChange={() => setDifference("highest")}
                />{" "}
                Top set
              </label>
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
              <span role="columnheader">CHANGED ITEMS</span>
              <span role="columnheader">DPS</span>
              <span role="columnheader">GAIN VS. EQUIPPED</span>
            </div>
            {report.rows.map((row, index) => {
              const changes = changedSlots(snapshot, base, row.loadout);
              return (
                <div
                  key={row.id}
                  role="row"
                  className={`combination-columns combination-row ${row.id === selected.id ? "selected" : ""}`}
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
                        const i = snapshot.inventory.find(
                          (i) => i.instanceId === row.loadout[slot],
                        );
                        return (
                          <span
                            key={slot}
                            title={`${slotNames[slot]}: ${i ? getCatalog().items.get(i.itemId)?.name : "Empty"}`}
                          >
                            {i ? (
                              <ItemLink
                                item={i}
                                aria-label={
                                  getCatalog().items.get(i.itemId)?.name
                                }
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ItemIcon itemId={i.itemId} size={40} />
                              </ItemLink>
                            ) : (
                              <span className="empty-icon">—</span>
                            )}
                            <small>{slotNames[slot]}</small>
                          </span>
                        );
                      })}
                      {changes.length > 5 && (
                        <span className="muted">+{changes.length - 5}</span>
                      )}
                    </span>
                    <span
                      className={
                        row.id === report.recommendedId && preferFewer
                          ? "gain"
                          : "muted"
                      }
                    >
                      {row.isEquipped
                        ? "Equipped"
                        : row.id === report.highestId
                          ? report.coverage.exhaustive
                            ? "Highest DPS"
                            : "Best found"
                          : row.id === report.recommendedId && preferFewer
                            ? "Recommended · Tied"
                            : row.tiedToHighest
                              ? "Within uncertainty"
                              : ""}
                      {!row.eligible ? " · Reference only" : ""}
                    </span>
                  </span>
                  <strong role="cell">{number(row.dps)}</strong>
                  <span className="gain" role="cell">
                    {signed(row.gain)}
                    <small>
                      {row.percent === null ? "" : `${row.percent.toFixed(2)}%`}
                    </small>
                  </span>
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
          <p className="muted small uncertainty-note">
            “Tied” means the difference is within pairwise sampling uncertainty.
            It does not guarantee the same DPS. Numeric ranking stays unchanged.
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
          Engine {snapshot.versions.engine.slice(0, 12)} ·{" "}
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
          {refreshError ? `Showing the last received results. ${error}` : error}
        </p>
      )}
      {full && selected && (
        <FullSet
          snapshot={snapshot}
          row={selected}
          onClose={() => setFull(false)}
        />
      )}
    </section>
  );
}
function GearStrip({
  snapshot,
  loadout,
  base,
}: {
  snapshot: Snapshot;
  loadout: Loadout;
  base: Loadout;
}) {
  const changed = changedSlots(snapshot, base, loadout);
  return (
    <div className="gear-strip" aria-label="Complete 17-slot gear set">
      {slots.map((slot) => {
        const item = snapshot.inventory.find(
          (i) => i.instanceId === loadout[slot],
        );
        return (
          <div
            key={slot}
            className={
              changed.includes(slot) ? "gear-slot changed" : "gear-slot"
            }
            title={item ? getCatalog().items.get(item.itemId)?.name : "Empty"}
          >
            <span>{slotNames[slot]}</span>
            {item ? (
              <ItemLink
                item={item}
                aria-label={getCatalog().items.get(item.itemId)?.name}
              >
                <ItemIcon itemId={item.itemId} />
              </ItemLink>
            ) : (
              <span className="empty-icon">—</span>
            )}
            <small>
              {item ? getCatalog().items.get(item.itemId)?.ilvl : "Empty"}
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
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog full-set-dialog"
      onCancel={onClose}
    >
      <div className="section-top">
        <h2>Full gear · {number(row.dps)} DPS</h2>
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
                  <ItemLink
                    item={item}
                    aria-label={getCatalog().items.get(item.itemId)?.name}
                  >
                    <ItemIcon itemId={item.itemId} />
                  </ItemLink>
                  <ItemLink item={item}>
                    <ItemName item={item} />
                  </ItemLink>
                  <ItemDetails item={item} />
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

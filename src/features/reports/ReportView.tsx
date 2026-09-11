"use client";
import { CharacterBackground } from "@/features/shell/CharacterBackground";
import {
  Alert,
  AlertContent,
  AlertActions,
  AlertAction,
  AlertMessage,
} from "@/components/ui/Alert";
import { PageHeading } from "@/components/ui/layout";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { useToastManager } from "@/components/ui/Toast";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TopGearReport, SetRow } from "@/domain/top-gear/model";
import {
  decodeSnapshot,
  encodeSnapshot,
} from "@/domain/top-gear/request-schema";
import { changedResultSlots } from "@/domain/top-gear/report";
import { withEnhancements } from "@/domain/equipment/enhancements";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
import { itemVersions, itemVersionOf } from "@/domain/top-gear/item-version";
import { getSpec } from "@/features/settings/registry";
import { saveDraft } from "@/features/import/draft-store";
import { ResultSummary } from "./ResultSummary";
import { StatsDetails } from "./StatsDetails";
import { ReportLoading } from "./ReportLoading";
import { CombinationTable } from "./CombinationTable";
import type { ReportAccess } from "@/domain/accounts/contracts";
import { useAccount } from "../auth/AuthProvider";
import { loadReturnState, clearReturnState } from "../auth/return-state";
import { characterSpecIcon } from "../inventory/CharacterPortrait";
import { ReportSave } from "./ReportSave";
import { useReport } from "./use-report";
import "./report-refinements.css";
import { useLocale, useTranslations } from "next-intl";
import { describeError, type ErrorDescriptor } from "@/i18n/error";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { number } from "./report-presentation";

type ReportResponse = {
  jobId: string;
  report: Omit<TopGearReport, "snapshot"> & {
    snapshot: ReturnType<typeof encodeSnapshot>;
  };
  canManage: boolean;
  access: ReportAccess;
  error: string | null;
  pinnedRows: SetRow[];
  totalRows: number;
  nextCursor: number | null;
};
export function ReportView({ token }: { token: string }) {
  const t = useTranslations("reports");
  const ta = useTranslations("auth");
  const auth = useAccount();
  const [restoration] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const key = sessionStorage.getItem(
        `munigan.auth.restore./reports/${token}`,
      );
      const state = key ? loadReturnState(key) : null;
      return state?.reportPath === `/reports/${token}`
        ? { key: key!, state }
        : null;
    } catch {
      return null;
    }
  });
  const restored = useRef(false);
  const [restoreConsumed, setRestoreConsumed] = useState(false);
  const diagnostics = useTranslations("diagnostics");
  const locale = useLocale();
  useEffect(() => {
    document.title = `${t("reportLabel")} · munigan.app`;
  }, [t]);
  const toastManager = useToastManager();
  const router = useRouter(),
    [actionError, setError] = useState<ErrorDescriptor | null>(null),
    [notice, setNotice] = useState(""),
    [selection, setSelection] = useState<{ token: string; row: SetRow } | null>(
      null,
    ),
    [difference, setDifference] = useState<"equipped" | "highest">(
      restoration?.state.difference ?? "equipped",
    ),
    [requestedCursor, setCursor] = useState(restoration?.state.cursor ?? 0),
    [showStats, setShowStats] = useState(false),
    [busy, setBusy] = useState(false);
  const retryIntent = useRef({ jobId: "", key: "" });
  const {
    data,
    refresh,
    permissionsFresh,
    url: loadedUrl,
    isPending,
    error: refreshError,
    diagnostic: refreshDiagnostic,
  } = useReport<ReportResponse>(
    `/api/reports/${token}?cursor=${requestedCursor}`,
    token,
    `${auth.status}:${auth.account?.id ?? ""}`,
  );
  const cursor = Number(
    new URLSearchParams(loadedUrl.split("?")[1]).get("cursor") ?? 0,
  );
  const error = actionError || refreshDiagnostic || refreshError;
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
    rows.find((r) => selection?.token === token && r.id === selection.row.id) ??
    (selection?.token === token ? selection.row : undefined) ??
    (!restoreConsumed
      ? rows.find((r) => r.id === restoration?.state.selectedId)
      : undefined) ??
    rows.find((r) => r.id === report?.recommendedId) ??
    rows.find((r) => r.id === report?.highestId) ??
    rows[0];
  useEffect(() => {
    if (!restoration || restored.current || !data || isPending) return;
    const row = [...data.pinnedRows, ...data.report.rows].find(
      (r) => r.id === restoration.state.selectedId,
    );
    const frame = requestAnimationFrame(() => {
      if (restored.current) return;
      restored.current = true;
      setRestoreConsumed(true);
      if (row) setSelection({ token, row });
      window.scrollTo({ top: restoration.state.scrollY, behavior: "instant" });
      try {
        clearReturnState(restoration.key);
        sessionStorage.removeItem(`munigan.auth.restore./reports/${token}`);
      } catch {
        /* Restored state remains valid if cleanup is blocked. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [data, isPending, restoration, token]);
  function setSelectedId(id: string) {
    const row = rows.find((item) => item.id === id);
    if (row) setSelection({ token, row });
  }
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
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/reports/${token}`,
      );
      toastManager.add({
        id: "share-report",
        type: "success",
        title: t("shareCopied"),
        description: t("shareDescription"),
      });
    } catch {
      toastManager.add({
        id: "share-report",
        type: "error",
        title: t("shareFailed"),
        description: t("shareRetry"),
        priority: "high",
      });
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
      if (!r.ok) throw describeError(result);
      if (action === "retry") router.push(result.reportUrl);
      else setNotice("cancelNotice");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }
  function edit() {
    if (!snapshot || !report || !selected) return;
    try {
      const next = structuredClone(snapshot);
      saveDraft({
        tool: "top-gear",
        precision: "standard",
        snapshot: next,
        selection: report.selection,
      });
      router.push("/gear-lab?restore=1");
    } catch (e) {
      setError(describeError(e));
    }
  }
  if (!data || !snapshot || !report) return <ReportLoading error={error} />;
  const active = report.status === "queued" || report.status === "running",
    spec = getSpec(snapshot.specId);
  return (
    <ItemVersionContext.Provider value={itemVersionOf(snapshot)}>
      <section id="content" className="report-view gear-lab-page">
        <CharacterBackground specId={snapshot.specId} />
        <PageHeading className="page-heading">
          <h1>GEAR LAB</h1>
          <p>
            {snapshot.settings.player!.name} · {spec.name} {spec.className} · 80
            <span className="report-item-version">
              {itemVersions[itemVersionOf(snapshot)].label}
            </span>
          </p>
          <div className="heading-action actions">
            <Button variant="secondary" onClick={share}>
              {t("share")}
              <svg
                className="shrink-0"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V3m-4 4 4-4 4 4M7 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
              </svg>
            </Button>
            <Button
              variant="primary"
              className="primary"
              onClick={() => edit()}
            >
              {t("edit")}
            </Button>
          </div>
        </PageHeading>
        {data.access && (
          <ReportSave
            key={token}
            token={token}
            access={{
              ...data.access,
              canSave: permissionsFresh && data.access.canSave,
              canManage: permissionsFresh && data.access.canManage,
            }}
            onSaved={refresh}
            character={{
              name: snapshot.settings.player!.name,
              specialization: `${spec.name} ${spec.className}`,
              icon:
                characterSpecIcon(
                  spec.className,
                  snapshot.settings.player!.talentsString,
                ) ??
                `classicon_${spec.className.toLowerCase().replaceAll(" ", "")}`,
              dps: selected?.dps,
              percent: selected?.percent,
            }}
            getViewState={() => ({
              version: 1,
              reportPath: `/reports/${token}`,
              locale: locale === "pt-BR" ? "pt-BR" : "en-US",
              cursor,
              selectedId: selected?.id ?? null,
              difference,
              scrollY: window.scrollY,
            })}
          />
        )}
        {active && (
          <Alert role="status" className="mb-6">
            <AlertContent icon="history">
              <div className="job-progress flex flex-col gap-4">
                <div className="section-top">
                  <div>
                    <p className="eyebrow">
                      {report.status === "queued"
                        ? t("waiting")
                        : t("simulating")}
                    </p>
                    <h2>
                      {report.status === "queued"
                        ? t("queued")
                        : report.phase === "equipped"
                          ? t("equippedPhase")
                          : t("comparing")}
                    </h2>
                  </div>
                  <span className="badge">
                    {t("progressCount", {
                      succeeded: number(report.coverage.succeeded, locale),
                      planned:
                        report.coverage.planned === null
                          ? "—"
                          : number(report.coverage.planned, locale),
                    })}
                  </span>
                </div>
                <progress
                  aria-label={t("progress")}
                  value={
                    report.status === "queued" ||
                    report.coverage.planned === null
                      ? undefined
                      : report.coverage.succeeded
                  }
                  max={Math.max(1, report.coverage.planned ?? 1)}
                />
                <p className="muted">{t("returnLater")}</p>
              </div>
            </AlertContent>
            {permissionsFresh && data.access.canManage && (
              <AlertActions>
                <AlertAction
                  disabled={busy}
                  onClick={() => management("cancel")}
                >
                  {t("cancel")}
                </AlertAction>
              </AlertActions>
            )}
          </Alert>
        )}
        {!active && report.status !== "complete" && (
          <Alert
            tone={report.status === "failed" ? "error" : "warning"}
            role="status"
            className="mb-6"
          >
            <AlertContent
              icon={report.status === "failed" ? "error" : "warning"}
            >
              <div className="flex flex-col gap-2">
                <p className="eyebrow">
                  {report.coverage.succeeded ? t("savedResults") : t("stopped")}
                </p>
                <h2 className="font-display text-[28px] leading-8">
                  {report.status === "canceled"
                    ? t("canceled")
                    : report.status === "partial"
                      ? t("partial")
                      : t("failed")}
                </h2>
                <p>
                  {report.termination === "runtime-limit"
                    ? t("runtimeLimit")
                    : data.error
                      ? localizeDiagnostic(data.error, diagnostics)
                      : t("retained")}{" "}
                  {t("evaluated", {
                    succeeded: number(report.coverage.succeeded, locale),
                    planned:
                      report.coverage.planned === null
                        ? t("unknown")
                        : number(report.coverage.planned, locale),
                  })}
                </p>
              </div>
            </AlertContent>
            {permissionsFresh && data.access.canManage && (
              <AlertActions>
                <AlertAction
                  disabled={busy}
                  onClick={() => management("retry")}
                >
                  {t("retry")}
                </AlertAction>
              </AlertActions>
            )}
          </Alert>
        )}
        {selected && base && (
          <>
            <ResultSummary
              selected={selected}
              report={report}
              selectedSnapshot={selectedSnapshot!}
              base={base}
              selectedChanges={selectedChanges}
              requiredChanges={requiredChanges}
              difference={difference}
              onStats={() => setShowStats(true)}
            />
            <div className="combinations-heading section-top">
              <h2>
                {t("combinations")}{" "}
                <span className="muted small">
                  {t("tested", { count: report.coverage.succeeded })}
                </span>
              </h2>
              <div className="difference-controls">
                <span className="muted">{t("differences")}</span>
                <div
                  className="report-segmented"
                  role="radiogroup"
                  aria-label={t("differencesLabel")}
                >
                  <label>
                    <input
                      type="radio"
                      name="difference"
                      checked={difference === "equipped"}
                      onChange={() => setDifference("equipped")}
                    />
                    <span>{t("equipped")}</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="difference"
                      checked={difference === "highest"}
                      onChange={() => setDifference("highest")}
                    />
                    <span>{t("topSet")}</span>
                  </label>
                </div>
              </div>
            </div>
            <CombinationTable
              snapshot={snapshot}
              report={report}
              base={base}
              baseGems={baseGems}
              baseEnchants={baseEnchants}
              selected={selected}
              cursor={cursor}
              setSelectedId={setSelectedId}
            />
            <Pagination
              page={Math.floor(cursor / 20) + 1}
              pending={isPending}
              hasPrevious={cursor > 0}
              hasNext={data.nextCursor !== null}
              onPrevious={() => setCursor(Math.max(0, cursor - 20))}
              onNext={() => setCursor(data.nextCursor!)}
              range={{
                start: report.rows.length ? cursor + 1 : 0,
                end: report.rows.length ? cursor + report.rows.length : 0,
                total: data.totalRows,
              }}
            />
            <p
              id="report-tie-explanation"
              className="muted small uncertainty-note"
            >
              {t("tieExplanation")}
            </p>
          </>
        )}

        <details className="simulation-details">
          <summary>{t("simulationDetails")}</summary>
          <p>
            {t("iterations", { count: report.policy.iterationsPerSet })} ·{" "}
            {report.coverage.exhaustive ? t("exhaustive") : t("incomplete")}
          </p>
          <p>
            {data.access.effectiveExpiresAt === null
              ? ta("retained")
              : t("retentionDetails", {
                  failed: report.coverage.failed,
                  returned: report.coverage.returned,
                  date: new Date(
                    data.access.effectiveExpiresAt,
                  ).toLocaleDateString(locale, {
                    timeZone: "UTC",
                  }),
                })}
          </p>
          <p>
            {t("engineDetails", {
              engine: snapshot.versions.engine.slice(0, 12),
              revision: snapshot.itemDataRevision ?? "—",
              duration: snapshot.settings.encounter!.duration,
              targets: snapshot.settings.encounter!.targets.length,
            })}
          </p>
        </details>
        {notice && <AlertMessage>{t("cancelNotice")}</AlertMessage>}
        {error && (
          <AlertMessage tone="error">
            {refreshError
              ? `${t("lastResults")} ${localizeDiagnostic(error, diagnostics)}`
              : localizeDiagnostic(error, diagnostics)}
          </AlertMessage>
        )}
        {showStats && selected && (
          <StatsDetails
            row={selected}
            snapshot={selectedSnapshot!}
            onClose={() => setShowStats(false)}
          />
        )}
      </section>
    </ItemVersionContext.Provider>
  );
}

import type {
  SimulationResult,
  TopGearReport,
  TopGearRequest,
  RunPlan,
  WorkPolicy,
} from "@/domain/top-gear/model";
import {
  decodeSnapshot,
  encodeSnapshot,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import { loadoutKey } from "@/domain/equipment/enumerate";
import { rankResults } from "@/domain/top-gear/report";
import { recommendedBuild } from "@/domain/top-gear/recommendation";
import { pool } from "@/server/db/client";

type StoredRequest = ReturnType<typeof encodeRequest>;
type ProjectionJob = {
  id: string;
  request: StoredRequest;
  policy: WorkPolicy;
  status: TopGearReport["status"];
  phase: TopGearReport["phase"];
  plan: RunPlan | null;
  termination: TopGearReport["termination"];
  expires_at: Date;
};

export type StoredReport = ReturnType<typeof encodeReport>;

function requestOf(job: ProjectionJob): TopGearRequest {
  return { ...job.request, snapshot: decodeSnapshot(job.request.snapshot) };
}

export const encodeReport = (report: TopGearReport) => ({
  ...report,
  snapshot: encodeSnapshot(report.snapshot),
});

export async function projectReport(jobId: string): Promise<TopGearReport> {
  const jobs = await pool.query("SELECT * FROM tg_jobs WHERE id=$1", [jobId]);
  if (!jobs.rowCount) throw new Error("Report job not found");
  const job = jobs.rows[0] as ProjectionJob;
  const request = requestOf(job);
  const work = await pool.query(
    "SELECT result,error FROM tg_work WHERE job_id=$1",
    [job.id],
  );
  const results = work.rows
    .filter((row) => row.result)
    .map((row) => row.result as SimulationResult);
  const ranked = rankResults(
    request.snapshot,
    results,
    job.plan?.candidateLoadouts ?? [],
  );
  return {
    token: "",
    status: job.status,
    phase: job.phase,
    snapshot: request.snapshot,
    selection: request.selection,
    policy: job.policy,
    ...ranked,
    coverage: {
      planned: job.plan?.simulations.length ?? null,
      succeeded: results.length,
      failed: work.rows.filter((row) => row.error && !row.result).length,
      returned: ranked.rows.length,
      exhaustive: job.status === "complete",
    },
    termination: job.termination,
    expiresAt: job.expires_at.toISOString(),
  };
}

export function projectStoredReport(
  stored: StoredReport,
  token: string,
): TopGearReport {
  let report = stored;
  const snapshot = decodeSnapshot(report.snapshot);
  if (
    new Set(
      report.rows.map((row) =>
        loadoutKey(snapshot, row.loadout, row.isEquipped),
      ),
    ).size < report.rows.length
  ) {
    const ranked = rankResults(
      snapshot,
      report.rows.map((row) => ({
        isReference: row.isEquipped,
        loadout: row.loadout,
        gemOverrides: row.gemOverrides,
        enchantOverrides: row.enchantOverrides,
        enchantWarnings: row.enchantWarnings,
        gemWarnings: row.gemWarnings,
        inputHash: row.inputHash,
        metric: {
          mean: row.dps,
          stdev: row.stdev ?? null,
          iterations: row.iterations,
        },
        stats: row.stats ?? [],
      })),
      report.rows.filter((row) => row.eligible).map((row) => row.loadout),
    );
    report = {
      ...report,
      ...ranked,
      coverage: { ...report.coverage, returned: ranked.rows.length },
    };
  }
  return {
    ...report,
    token,
    recommendedId: recommendedBuild(snapshot, report.rows),
  } as unknown as TopGearReport;
}

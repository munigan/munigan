import { randomUUID } from "node:crypto";
import { pool, transaction } from "@/server/db/client";
import {
  decodeSnapshot,
  encodeSnapshot,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import type {
  TopGearRequest,
  RunPlan,
  WorkPolicy,
  SimulationResult,
  TopGearReport,
} from "@/domain/top-gear/model";
import { planRun, loadoutKey } from "@/domain/equipment/enumerate";
import { rankResults } from "@/domain/top-gear/report";
import { recommendedBuild } from "@/domain/top-gear/recommendation";
import { evaluate } from "@/server/simulator/evaluate";
import { digest } from "./capabilities";
import { limits } from "./policy";
import { AdmissionError, admitJob } from "./admit";
type StoredRequest = ReturnType<typeof encodeRequest>;
type Job = {
  id: string;
  owner_hash: string;
  request: StoredRequest;
  policy: WorkPolicy;
  status: TopGearReport["status"];
  phase: TopGearReport["phase"];
  plan: RunPlan | null;
  report: ReturnType<typeof encodeReport> | null;
  termination: TopGearReport["termination"];
  error: string | null;
  expires_at: Date;
  created_at: Date;
  deadline_at: Date | null;
  cancel_requested: boolean;
  lease: string | null;
  reserved: number;
  budget_day: Date;
  settled: boolean;
};
function requestOf(job: Job): TopGearRequest {
  return { ...job.request, snapshot: decodeSnapshot(job.request.snapshot) };
}
const encodeReport = (report: TopGearReport) => ({
  ...report,
  snapshot: encodeSnapshot(report.snapshot),
});
async function claim(jobId?: string) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(33050336)");
    const busy = await c.query(
      "SELECT count(*)::int count FROM tg_jobs WHERE status='running' AND lease_until>now()",
    );
    if (busy.rows[0].count >= limits().concurrency) return null;
    const rows = await c.query(
      "SELECT * FROM tg_jobs WHERE (status='queued' AND (lease_until IS NULL OR lease_until<now()) OR status='running' AND lease_until<now()) AND ($1::uuid IS NULL OR id=$1) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
      [jobId ?? null],
    );
    if (!rows.rowCount) return null;
    const job = rows.rows[0] as Job,
      lease = randomUUID();
    const canceled =
      job.cancel_requested ||
      Date.now() - job.created_at.getTime() > 30 * 60 * 1000;
    const updated = await c.query(
      "UPDATE tg_jobs SET status='running',lease=$2,lease_until=now()+interval '30 seconds',deadline_at=coalesce(deadline_at,now()+$3*interval '1 second'),cancel_requested=$4 WHERE id=$1 RETURNING deadline_at",
      [job.id, lease, job.policy.maxJobSeconds, canceled],
    );
    return {
      ...job,
      status: "running" as const,
      lease,
      deadline_at: updated.rows[0].deadline_at as Date,
      cancel_requested: canceled,
    };
  });
}
async function projection(job: Job): Promise<TopGearReport> {
  const request = requestOf(job);
  const work = await pool.query(
    "SELECT result,error FROM tg_work WHERE job_id=$1",
    [job.id],
  );
  const results = work.rows
    .filter((r) => r.result)
    .map((r) => r.result as SimulationResult);
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
      failed: work.rows.filter((r) => r.error && !r.result).length,
      returned: ranked.rows.length,
      exhaustive: job.status === "complete",
    },
    termination: job.termination,
    expiresAt: job.expires_at.toISOString(),
  };
}
async function finish(
  jobId: string,
  lease: string,
  termination: TopGearReport["termination"],
  error?: string,
) {
  const rows = await pool.query(
    "SELECT * FROM tg_jobs WHERE id=$1 AND lease=$2",
    [jobId, lease],
  );
  if (!rows.rowCount) return;
  const job = rows.rows[0] as Job;
  const report = await projection(job);
  const all =
    report.coverage.planned !== null &&
    report.coverage.succeeded === report.coverage.planned &&
    report.coverage.failed === 0;
  report.status =
    termination === "complete" && all
      ? "complete"
      : termination === "canceled"
        ? "canceled"
        : report.rows.length
          ? "partial"
          : "failed";
  report.phase = "complete";
  report.termination =
    report.status === "complete"
      ? "complete"
      : termination === "complete"
        ? "failed"
        : termination;
  report.coverage.exhaustive = report.status === "complete";
  await transaction(async (c) => {
    const locked = await c.query(
      "SELECT * FROM tg_jobs WHERE id=$1 AND lease=$2 FOR UPDATE",
      [jobId, lease],
    );
    if (!locked.rowCount || locked.rows[0].settled) return;
    const attempts = await c.query(
      "SELECT coalesce(sum(attempts),0)::int count FROM tg_work WHERE job_id=$1",
      [jobId],
    );
    const spent = attempts.rows[0].count * job.policy.unitsPerSet;
    await c.query(
      "UPDATE tg_budgets SET reserved=reserved-$1,spent=spent+$2 WHERE day=$3",
      [job.reserved, spent, job.budget_day],
    );
    await c.query(
      "UPDATE tg_jobs SET status=$3,phase=$4,termination=$5,error=$6,report=$7,settled=true,lease_until=NULL WHERE id=$1 AND lease=$2",
      [
        jobId,
        lease,
        report.status,
        report.phase,
        report.termination,
        error?.slice(0, 500) ?? null,
        JSON.stringify(encodeReport(report)),
      ],
    );
  });
}
type ExecutionPhase =
  | "claim"
  | "planning"
  | "admission"
  | "evaluation"
  | "persistence"
  | "finalization";
export type ExecutionPerformance = {
  jobId: string;
  specId: string;
  concurrency: number;
  planned: number;
  attempts: number;
  succeeded: number;
  iterationsPerSet: number;
  elapsedMs: number;
  // Accumulated operation time: concurrent phases can exceed elapsedMs.
  phaseMs: Record<ExecutionPhase, number>;
  leaseLost: boolean;
  timedOut: boolean;
};
type ExecutionOptions = {
  concurrency?: number;
  onPerformance?: (measurement: ExecutionPerformance) => void;
};
export async function executeTopGear(
  jobId?: string,
  signal: AbortSignal = new AbortController().signal,
  evaluator: typeof evaluate = evaluate,
  options: ExecutionOptions = {},
) {
  const concurrency = options.concurrency ?? 1;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("Simulation concurrency must be between 1 and 4");
  const startedAt = performance.now();
  const phaseMs: Record<ExecutionPhase, number> = {
    claim: 0,
    planning: 0,
    admission: 0,
    evaluation: 0,
    persistence: 0,
    finalization: 0,
  };
  async function measure<T>(
    phase: ExecutionPhase,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      phaseMs[phase] += performance.now() - start;
    }
  }
  const job = await measure("claim", () => claim(jobId));
  if (!job) return false;
  let planned = 0,
    attempts = 0,
    succeeded = 0;
  const finalize = (
    termination: TopGearReport["termination"],
    error?: string,
  ) =>
    measure("finalization", () =>
      finish(job.id, job.lease, termination, error),
    );
  const controller = new AbortController();
  let canceled = false;
  const abort = () => {
    canceled = true;
    controller.abort(signal.reason);
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  let timeout = false,
    leaseLost = false;
  const timer = setTimeout(
    () => {
      timeout = true;
      controller.abort();
    },
    Math.max(1, job.deadline_at.getTime() - Date.now()),
  );
  let checking = false;
  const heartbeat = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      const r = await pool.query(
        "UPDATE tg_jobs SET lease_until=now()+interval '30 seconds' WHERE id=$1 AND lease=$2 AND status='running' RETURNING cancel_requested",
        [job.id, job.lease],
      );
      if (!r.rowCount) {
        leaseLost = true;
        controller.abort();
      } else if (r.rows[0].cancel_requested) {
        canceled = true;
        controller.abort();
      }
    } catch {
      leaseLost = true;
      controller.abort();
    } finally {
      checking = false;
    }
  }, 1000);
  try {
    if (job.cancel_requested) {
      await finalize("canceled");
      return true;
    }
    if (job.deadline_at.getTime() <= Date.now()) {
      await finalize("runtime-limit");
      return true;
    }
    const request = requestOf(job);
    const plan = await measure(
      "planning",
      () =>
        job.plan ?? planRun(request.snapshot, request.selection, job.policy),
    );
    planned = plan.simulations.length;
    await measure("persistence", () =>
      pool.query(
        "UPDATE tg_jobs SET plan=$3,phase='equipped' WHERE id=$1 AND lease=$2",
        [job.id, job.lease, JSON.stringify(plan)],
      ),
    );
    const runSet = async (index: number) => {
      const work = plan.simulations[index];
      for (let retry = 0; retry < job.policy.maxAttempts; retry++) {
        controller.signal.throwIfAborted();
        const admitted = await measure("admission", () =>
          transaction(async (c) => {
            const current = await c.query(
              "SELECT cancel_requested FROM tg_jobs WHERE id=$1 AND lease=$2 FOR UPDATE",
              [job.id, job.lease],
            );
            if (!current.rowCount) {
              leaseLost = true;
              controller.abort();
              return false;
            }
            if (current.rows[0].cancel_requested) {
              canceled = true;
              controller.abort();
              return false;
            }
            await c.query(
              "INSERT INTO tg_work(job_id,work_key) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [job.id, work.key],
            );
            const state = await c.query(
              "UPDATE tg_work SET attempts=attempts+1,error=NULL WHERE job_id=$1 AND work_key=$2 AND result IS NULL AND attempts<$3 RETURNING attempts",
              [job.id, work.key, job.policy.maxAttempts],
            );
            if (!state.rowCount)
              await c.query(
                "UPDATE tg_work SET error=coalesce(error,'Attempt limit reached') WHERE job_id=$1 AND work_key=$2 AND result IS NULL",
                [job.id, work.key],
              );
            return !!state.rowCount;
          }),
        );
        if (!admitted) break;
        try {
          controller.signal.throwIfAborted();
          attempts++;
          const result = await measure("evaluation", () =>
            evaluator(
              request.snapshot,
              work.loadout,
              work.iterations,
              work.seed,
              controller.signal,
              work.isReference ?? index === 0,
            ),
          );
          if (leaseLost) throw new Error("Worker lease lost");
          const saved = await measure("persistence", () =>
            pool.query(
              "UPDATE tg_work SET result=$3,error=NULL WHERE job_id=$1 AND work_key=$2 AND EXISTS(SELECT 1 FROM tg_jobs WHERE id=$1 AND lease=$4)",
              [job.id, work.key, JSON.stringify(result), job.lease],
            ),
          );
          if (!saved.rowCount) {
            leaseLost = true;
            controller.abort();
            throw new Error("Worker lease lost");
          }
          succeeded++;
          break;
        } catch (e) {
          if (leaseLost) throw e;
          const code = (e as NodeJS.ErrnoException).code;
          const transient =
            !!code &&
            [
              "EAGAIN",
              "EIO",
              "EMFILE",
              "ENFILE",
              "ENOSPC",
              "ECONNRESET",
              "ETIMEDOUT",
              "SIM_PROCESS_FAILED",
            ].includes(code);
          await measure("persistence", () =>
            pool.query(
              "UPDATE tg_work SET error=$3 WHERE job_id=$1 AND work_key=$2 AND EXISTS(SELECT 1 FROM tg_jobs WHERE id=$1 AND lease=$4)",
              [
                job.id,
                work.key,
                controller.signal.aborted
                  ? "Simulation interrupted"
                  : transient
                    ? "Temporary simulator infrastructure failure"
                    : "Simulator rejected this combination",
                job.lease,
              ],
            ),
          );
          if (controller.signal.aborted) throw e;
          if (!transient) break;
        }
      }
      controller.signal.throwIfAborted();
      if (index === 0)
        await measure("persistence", () =>
          pool.query(
            "UPDATE tg_jobs SET phase='combinations' WHERE id=$1 AND lease=$2",
            [job.id, job.lease],
          ),
        );
    };
    // Keep the reference durable before publishing candidate progress.
    if (planned) await runSet(0);
    let next = 1;
    let failure: { error: unknown } | undefined;
    const workers = await Promise.allSettled(
      Array.from(
        { length: Math.min(concurrency, Math.max(0, planned - 1)) },
        async () => {
          try {
            while (next < planned) {
              controller.signal.throwIfAborted();
              await runSet(next++);
            }
          } catch (error) {
            // Preserve the initiating failure; sibling aborts are a consequence.
            if (!controller.signal.aborted) failure = { error };
            controller.abort();
            throw error;
          }
        },
      ),
    );
    // allSettled keeps the lease/heartbeat alive until every child is drained.
    if (failure) throw failure.error;
    const rejected = workers.find((worker) => worker.status === "rejected");
    if (rejected) throw rejected.reason;
    controller.signal.throwIfAborted();
    await finalize("complete");
  } catch (e) {
    if (!leaseLost)
      await finalize(
        timeout
          ? "runtime-limit"
          : canceled
            ? "canceled"
            : e instanceof Error && e.message.includes("Search limit")
              ? "search-limit"
              : "failed",
        canceled || timeout
          ? undefined
          : e instanceof Error
            ? e.message
            : "Simulation failed",
      );
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    options.onPerformance?.({
      jobId: job.id,
      specId: job.request.snapshot.specId,
      concurrency,
      planned,
      attempts,
      succeeded,
      iterationsPerSet: job.policy.iterationsPerSet,
      elapsedMs: Math.round(performance.now() - startedAt),
      phaseMs: Object.fromEntries(
        Object.entries(phaseMs).map(([phase, ms]) => [phase, Math.round(ms)]),
      ) as Record<ExecutionPhase, number>,
      leaseLost,
      timedOut: timeout,
    });
  }
  return true;
}
export async function readReport(token: string, ownerKey?: string) {
  if (!/^[\w-]{43}$/.test(token))
    throw new AdmissionError("Report not found", 404);
  const r = await pool.query("SELECT * FROM tg_jobs WHERE token_hash=$1", [
    digest(token),
  ]);
  if (!r.rowCount) throw new AdmissionError("Report not found", 404);
  const job = r.rows[0] as Job;
  if (job.expires_at.getTime() < Date.now())
    throw new AdmissionError("This report has expired", 410);
  let report = job.report ?? encodeReport(await projection(job));
  const snapshot = decodeSnapshot(report.snapshot);
  if (
    new Set(
      report.rows.map((row) =>
        loadoutKey(snapshot, row.loadout, row.isEquipped),
      ),
    ).size < report.rows.length
  ) {
    // Normalize the read projection of historical reports before pagination.
    // Preserve the frozen stored report and each chosen simulation's metrics.
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
    jobId: job.id,
    report: {
      ...report,
      token,
      recommendedId: recommendedBuild(snapshot, report.rows),
    },
    canManage: !!ownerKey && digest(ownerKey) === job.owner_hash,
    error: job.error,
  };
}
export async function retryJob(
  jobId: string,
  ownerKey: string,
  idempotencyKey: string,
  sourceHash?: string,
) {
  const rows = await pool.query(
    "SELECT * FROM tg_jobs WHERE id=$1 AND owner_hash=$2 AND status IN ('partial','failed','canceled')",
    [jobId, digest(ownerKey)],
  );
  if (!rows.rowCount) throw new AdmissionError("Retry is unavailable", 404);
  const old = rows.rows[0] as Job;
  return admitJob({
    request: old.request,
    ownerKey,
    idempotencyKey,
    priorJob: old.id,
    sourceHash,
  });
}

// The provider must not acknowledge a targeted job that was refused for capacity.
export async function executeTargetedJob(
  jobId: string,
  signal: AbortSignal,
  options: ExecutionOptions = {},
) {
  const ran = await executeTopGear(jobId, signal, evaluate, options);
  if (!ran) {
    const r = await pool.query("SELECT status FROM tg_jobs WHERE id=$1", [
      jobId,
    ]);
    if (r.rows[0]?.status === "queued")
      throw new Error("Simulation capacity is temporarily occupied");
  }
}
export async function rescheduleQueuedJob(jobId: string) {
  await pool.query(
    "UPDATE tg_outbox SET dispatched_at=NULL,next_attempt_at=now()+interval '1 minute',generation=generation+1 WHERE job_id=$1 AND EXISTS(SELECT 1 FROM tg_jobs WHERE id=$1 AND status='queued')",
    [jobId],
  );
}
export async function settleQueuedJobs() {
  const jobs = await transaction(async (c) => {
    const r = await c.query(
      "SELECT id FROM tg_jobs WHERE status='queued' AND (cancel_requested OR created_at<now()-interval '30 minutes') AND (lease_until IS NULL OR lease_until<now()) FOR UPDATE SKIP LOCKED LIMIT 100",
    );
    const leased: Array<{ id: string; lease: string }> = [];
    for (const j of r.rows) {
      const lease = randomUUID();
      await c.query(
        "UPDATE tg_jobs SET lease=$2,lease_until=now()+interval '30 seconds',cancel_requested=true WHERE id=$1",
        [j.id, lease],
      );
      leased.push({ id: j.id, lease });
    }
    return leased;
  });
  for (const job of jobs) await finish(job.id, job.lease, "canceled");
}

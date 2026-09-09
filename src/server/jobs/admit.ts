import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { transaction } from "@/server/db/client";
import {
  validateRequest,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import { estimateAllowance, loadoutKey } from "@/domain/equipment/enumerate";
import { workPolicy, limits } from "./policy";
import { digest, capability, encrypt, decrypt } from "./capabilities";
function sameRequest(
  previous: unknown,
  current: ReturnType<typeof encodeRequest>,
) {
  try {
    // JSONB can reorder object keys. Normalize legacy profiles and compare
    // structure so retries survive an additive schema change without rewriting
    // the old report or ever sharing results across item profiles.
    return isDeepStrictEqual(encodeRequest(validateRequest(previous)), current);
  } catch {
    return false;
  }
}
export class AdmissionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function admitJob(args: {
  request: unknown;
  ownerKey: string;
  idempotencyKey: string;
  priorJob?: string;
  sourceHash?: string;
}) {
  if (!/^[\w-]{8,100}$/.test(args.idempotencyKey))
    throw new AdmissionError("A valid Idempotency-Key is required", 400);
  const request = validateRequest(args.request),
    policy = workPolicy(),
    allowance = estimateAllowance(request.snapshot, request.selection, policy);
  if (!allowance.allowed)
    throw new AdmissionError(
      "Reduce your item selections to fit the free allowance",
      422,
    );
  const frozen = encodeRequest(request),
    requestHash = digest(JSON.stringify(frozen)),
    ownerHash = digest(args.ownerKey),
    caps = limits();
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(33050335)");
    const existing = await c.query(
      "SELECT id,request_hash,token_cipher,request FROM tg_jobs WHERE owner_hash=$1 AND intent=$2",
      [ownerHash, args.idempotencyKey],
    );
    if (existing.rowCount) {
      const j = existing.rows[0];
      if (j.request_hash !== requestHash && !sameRequest(j.request, frozen))
        throw new AdmissionError(
          "This submission key belongs to a different selection",
          409,
        );
      return { jobId: j.id, reportToken: decrypt(j.token_cipher) };
    }
    const counts = await c.query(
      "SELECT count(*) FILTER(WHERE status IN ('queued','running'))::int backlog, count(*) FILTER(WHERE owner_hash=$1 AND status IN ('queued','running'))::int active, count(*) FILTER(WHERE owner_hash=$1 AND created_at>=date_trunc('day',now()))::int daily FROM tg_jobs",
      [ownerHash],
    );
    if (counts.rows[0].backlog >= caps.backlog)
      throw new AdmissionError(
        "The simulation queue is full. Try again shortly.",
        503,
      );
    if (
      counts.rows[0].active >= caps.ownerActive ||
      counts.rows[0].daily >= caps.ownerDaily
    )
      throw new AdmissionError(
        "Your free simulation limit has been reached. Try again later.",
        429,
      );
    if (args.sourceHash) {
      const source = await c.query(
        "SELECT count(*) FILTER(WHERE status IN ('queued','running'))::int active,count(*) FILTER(WHERE created_at>=date_trunc('day',now()))::int daily FROM tg_jobs WHERE source_hash=$1",
        [args.sourceHash],
      );
      if (source.rows[0].active >= 4 || source.rows[0].daily >= 40)
        throw new AdmissionError(
          "This connection has reached its free simulation limit",
          429,
        );
    }
    await c.query(
      "INSERT INTO tg_budgets(day) VALUES(current_date) ON CONFLICT DO NOTHING",
    );
    const reserve = allowance.units * policy.maxAttempts;
    const budget = await c.query(
      "UPDATE tg_budgets SET reserved=reserved+$1 WHERE day=current_date AND reserved+spent+$1<=$2 RETURNING day",
      [reserve, caps.dailyUnits],
    );
    if (!budget.rowCount)
      throw new AdmissionError(
        "Today’s free simulation capacity is full. Try again later.",
        503,
      );
    const jobId = randomUUID(),
      reportToken = capability();
    await c.query(
      "INSERT INTO tg_jobs(id,owner_hash,intent,request_hash,token_hash,token_cipher,request,policy,budget_day,reserved,prior_job) VALUES($1,$2,$3,$4,$5,$6,$7,$8,current_date,$9,$10)",
      [
        jobId,
        ownerHash,
        args.idempotencyKey,
        requestHash,
        digest(reportToken),
        encrypt(reportToken),
        JSON.stringify(frozen),
        JSON.stringify(policy),
        reserve,
        args.priorJob ?? null,
      ],
    );
    if (args.sourceHash)
      await c.query("UPDATE tg_jobs SET source_hash=$2 WHERE id=$1", [
        jobId,
        args.sourceHash,
      ]);
    if (args.priorJob) {
      const prior = await c.query(
        "SELECT policy,request,request_hash FROM tg_jobs WHERE id=$1 AND owner_hash=$2",
        [args.priorJob, ownerHash],
      );
      if (
        prior.rowCount &&
        (prior.rows[0].request_hash === requestHash ||
          sameRequest(prior.rows[0].request, frozen)) &&
        prior.rows[0].policy.iterationsPerSet === policy.iterationsPerSet
      )
        await c.query(
          // Ordered-pair results predate this optimizer and must be recomputed.
          "INSERT INTO tg_work(job_id,work_key,result) SELECT $1,work_key,result FROM tg_work WHERE job_id=$2 AND result IS NOT NULL AND work_key LIKE $3",
          [
            jobId,
            args.priorJob,
            loadoutKey(request.snapshot, request.snapshot.equipped).split(
              "[",
            )[0] + "%",
          ],
        );
    }
    await c.query("INSERT INTO tg_outbox(job_id) VALUES($1)", [jobId]);
    return { jobId, reportToken };
  });
}
export async function cancelJob(jobId: string, ownerKey: string) {
  return transaction(async (c) => {
    const r = await c.query(
      "UPDATE tg_jobs SET cancel_requested=true WHERE id=$1 AND owner_hash=$2 AND status IN ('queued','running') RETURNING id",
      [jobId, digest(ownerKey)],
    );
    return !!r.rowCount;
  });
}

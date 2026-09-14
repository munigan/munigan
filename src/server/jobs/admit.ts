import type { RequestIdentity } from "@/domain/accounts/contracts";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { AccountError } from "@/server/auth/errors";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { pool, transaction } from "@/server/db/client";
import {
  validateRequest,
  decodeDraft,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import {
  allowanceForCount,
  estimateAllowance,
  loadoutKey,
} from "@/domain/equipment/enumerate";
import { workPolicy, limits } from "./policy";
import { digest, capability, encrypt, decrypt } from "./capabilities";
import type pg from "pg";
import type { RunPlan } from "@/domain/top-gear/model";
import type { DiagnosticCode } from "@/i18n/error";
import { analyzePurchaseSelection } from "@/domain/purchases/analysis";
import { hydratePurchaseSnapshot } from "@/domain/purchases/frozen";
import { PurchaseEnhancementError } from "@/domain/purchases/enhancements";
import { SearchLimitError } from "@/domain/equipment/search-budget";

// Match validation's display-only normalization without consulting current recipes.
function structuralRequest(input: unknown) {
  const request = decodeDraft(input);
  const settings = request.snapshot.settings;
  settings.settings = undefined;
  settings.epWeightsStats = undefined;
  settings.epRatios = [];
  settings.player!.name = settings.player!.name.slice(0, 80);
  return request;
}
function sameRequest(
  previous: unknown,
  current: ReturnType<typeof encodeRequest>,
) {
  try {
    // JSONB can reorder object keys. Normalize legacy profiles and compare
    // structure so retries survive an additive schema change without rewriting
    // the old report or ever sharing results across item profiles.
    return isDeepStrictEqual(
      encodeRequest(structuralRequest(previous)),
      current,
    );
  } catch {
    return false;
  }
}
export class AdmissionError extends Error {
  constructor(
    message: string,
    public status: number,
    public diagnostic?: {
      code: DiagnosticCode;
      params?: Record<string, string | number>;
    },
  ) {
    super(message);
  }
}
export async function admitJob(args: {
  identity?: RequestIdentity;
  request: unknown;
  ownerKey: string;
  idempotencyKey: string;
  priorJob?: string;
  sourceHash?: string;
}) {
  if (!/^[\w-]{8,100}$/.test(args.idempotencyKey))
    throw new AdmissionError("A valid Idempotency-Key is required", 400);
  let request = structuralRequest(args.request);
  const policy = workPolicy(request.iterations);
  const frozen = encodeRequest(request),
    requestHash = digest(JSON.stringify(frozen)),
    ownerHash = digest(args.ownerKey),
    caps = limits();
  const identity = args.identity ?? { account: null, ownerHash };
  const accountId = identity.account?.id ?? null;
  async function lookup(c: Pick<pg.PoolClient, "query">, lock = false) {
    let prior;
    if (args.priorJob) {
      const rows = await c.query(
        "SELECT *, expires_at<=now() expired, EXISTS(SELECT 1 FROM library_items li WHERE li.job_id=tg_jobs.id AND li.deleted_at IS NULL) retained FROM tg_jobs WHERE id=$1" +
          (lock ? " FOR UPDATE" : ""),
        [args.priorJob],
      );
      prior = rows.rows[0];
      if (
        !prior ||
        prior.deleted_at ||
        (prior.account_id
          ? prior.account_id !== accountId
          : prior.owner_hash !== identity.ownerHash)
      )
        throw new AccountError("NOT_FOUND", 404);
      if (!prior.retained && prior.expired)
        throw new AccountError("REPORT_EXPIRED", 410);
      if (!["partial", "failed", "canceled"].includes(prior.status))
        throw new AccountError("NOT_FOUND", 404);
    }
    const existing = await c.query(
      "SELECT id,request_hash,token_cipher,request,deleted_at,account_id,admission_account_id FROM tg_jobs WHERE owner_hash=$1 AND intent=$2",
      [ownerHash, args.idempotencyKey],
    );
    if (existing.rowCount) {
      const j = existing.rows[0];
      if (j.deleted_at) throw new AccountError("NOT_FOUND", 404);
      if (
        j.admission_account_id !== accountId ||
        (j.account_id && j.account_id !== accountId)
      )
        throw new AdmissionError(
          "This submission key belongs to a different admission identity",
          409,
        );
      if (j.request_hash !== requestHash && !sameRequest(j.request, frozen))
        throw new AdmissionError(
          "This submission key belongs to a different selection",
          409,
        );
      return {
        prior,
        admission: {
          jobId: j.id as string,
          reportToken: decrypt(j.token_cipher),
        },
      };
    }
    return { prior, admission: undefined };
  }
  // Read first; expensive planning does not hold the global admission lock.
  const preflight = await lookup(pool);
  if (preflight.admission) {
    // The transactional recheck also enforces active account lifecycle.
    return transaction(async (c) => {
      if (accountId) await lockActiveAccount(c, accountId);
      await c.query("SELECT pg_advisory_xact_lock(33050335)");
      const checked = await lookup(c, true);
      if (!checked.admission)
        throw new AdmissionError("Submission changed", 409);
      return checked.admission;
    });
  }
  let plan: RunPlan | null = null;
  try {
    if (
      request.purchases &&
      preflight.prior &&
      sameRequest(preflight.prior.request, frozen)
    ) {
      const old = preflight.prior.plan as RunPlan | null;
      if (!old?.purchases || !Array.isArray(old.simulations))
        throw new Error("Missing frozen purchase plan");
      // Gear and resource explanations stay frozen, but execution policy is current.
      plan = {
        ...old,
        allowance: allowanceForCount(old.simulations.length, policy),
        simulations: old.simulations.map((simulation, index) => ({
          ...simulation,
          iterations: policy.iterationsPerSet,
          seed: String(100000 + index * (policy.iterationsPerSet + 1)),
        })),
      };
    } else {
      request = validateRequest(frozen);
      if (request.purchases) {
        const analysis = analyzePurchaseSelection(request, policy);
        switch (analysis.status) {
          case "complete":
            plan = analysis.plan;
            break;
          case "no-legal-sets":
            throw new AdmissionError("No legal purchase sets", 422, {
              code: "purchaseNoLegalSets",
            });
          case "over-limit":
            throw new AdmissionError("Purchase allowance exceeded", 422, {
              code: "purchaseAllowanceExceeded",
            });
          case "search-limit":
            throw new AdmissionError("Purchase search limit reached", 422, {
              code: "purchaseSearchLimit",
            });
          case "catalog-changed":
            throw new AdmissionError("Purchase catalog changed", 422, {
              code: "purchaseCatalogChanged",
            });
        }
      }
    }
  } catch (error) {
    if (error instanceof PurchaseEnhancementError)
      throw new AdmissionError(error.message, 422, {
        code: "purchaseEnhancementInvalid",
        params: { itemId: error.itemId, profile: error.profile },
      });
    if (request.purchases && error instanceof SearchLimitError)
      throw new AdmissionError("Purchase search limit reached", 422, {
        code: "purchaseSearchLimit",
      });
    throw error;
  }
  const allowance =
    plan?.allowance ??
    estimateAllowance(request.snapshot, request.selection, policy);
  if (!allowance.allowed)
    throw new AdmissionError(
      "Reduce your item selections to fit the free allowance",
      422,
      request.purchases ? { code: "purchaseAllowanceExceeded" } : undefined,
    );
  return transaction(async (c) => {
    if (accountId) await lockActiveAccount(c, accountId);
    await c.query("SELECT pg_advisory_xact_lock(33050335)");
    const { prior, admission } = await lookup(c, true);
    if (admission) return admission;
    if (
      plan &&
      preflight.prior &&
      !isDeepStrictEqual(prior?.plan, preflight.prior.plan)
    )
      throw new AdmissionError("Prior purchase plan changed", 409);
    const counts = await c.query(
      "SELECT count(*) FILTER(WHERE status IN ('queued','running'))::int backlog, count(*) FILTER(WHERE owner_hash=$1 AND status IN ('queued','running'))::int active, count(*) FILTER(WHERE owner_hash=$1 AND created_at>=date_trunc('day',now()))::int daily, count(*) FILTER(WHERE account_id=$2 AND status IN ('queued','running'))::int account_active, count(*) FILTER(WHERE account_id=$2 AND created_at>=date_trunc('day',now()))::int account_daily FROM tg_jobs",
      [ownerHash, accountId],
    );
    if (!caps.unlimited && counts.rows[0].backlog >= caps.backlog)
      throw new AdmissionError(
        "The simulation queue is full. Try again shortly.",
        503,
      );
    if (
      !caps.unlimited &&
      (counts.rows[0].active >= caps.ownerActive ||
        counts.rows[0].daily >= caps.ownerDaily ||
        counts.rows[0].account_active >= caps.accountActive ||
        counts.rows[0].account_daily >= caps.accountDaily)
    )
      throw new AdmissionError(
        "Your free simulation limit has been reached. Try again later.",
        429,
      );
    if (args.sourceHash && !caps.unlimited) {
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
    // Local uncapped work does not reserve or consume the production quota ledger.
    const reserve = caps.unlimited ? 0 : allowance.units * policy.maxAttempts;
    const budget = await c.query(
      "UPDATE tg_budgets SET reserved=reserved+$1 WHERE day=current_date AND ($3::boolean OR reserved+spent+$1<=$2) RETURNING day",
      [reserve, caps.dailyUnits, caps.unlimited],
    );
    if (!budget.rowCount)
      throw new AdmissionError(
        "Today’s free simulation capacity is full. Try again later.",
        503,
      );
    const jobId = randomUUID(),
      reportToken = capability();
    await c.query(
      "INSERT INTO tg_jobs(id,owner_hash,intent,request_hash,token_hash,token_cipher,request,policy,budget_day,reserved,prior_job,account_id,admission_account_id,plan) VALUES($1,$2,$3,$4,$5,$6,$7,$8,current_date,$9,$10,$11,$11,$12)",
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
        accountId,
        plan ? JSON.stringify(plan) : null,
      ],
    );
    if (args.sourceHash)
      await c.query("UPDATE tg_jobs SET source_hash=$2 WHERE id=$1", [
        jobId,
        args.sourceHash,
      ]);
    if (prior) {
      if (
        (prior.request_hash === requestHash ||
          sameRequest(prior.request, frozen)) &&
        prior.policy.iterationsPerSet === policy.iterationsPerSet
      )
        await c.query(
          // Ordered-pair results predate this optimizer and must be recomputed.
          "INSERT INTO tg_work(job_id,work_key,result) SELECT $1,work_key,result FROM tg_work WHERE job_id=$2 AND result IS NOT NULL AND work_key LIKE $3",
          [
            jobId,
            args.priorJob,
            loadoutKey(
              plan?.purchases
                ? hydratePurchaseSnapshot(request.snapshot, plan.purchases)
                : request.snapshot,
              request.snapshot.equipped,
            ).split("[")[0] + "%",
          ],
        );
    }
    await c.query("INSERT INTO tg_outbox(job_id) VALUES($1)", [jobId]);
    return { jobId, reportToken };
  });
}
export async function cancelJob(
  jobId: string,
  identity: RequestIdentity,
): Promise<void> {
  await transaction(async (c) => {
    if (identity.account) await lockActiveAccount(c, identity.account.id);
    const r = await c.query(
      "UPDATE tg_jobs SET cancel_requested=true WHERE id=$1 AND deleted_at IS NULL AND ((account_id IS NOT NULL AND account_id=$2) OR (account_id IS NULL AND owner_hash=$3)) AND status IN ('queued','running') AND expires_at>now() RETURNING id",
      [jobId, identity.account?.id ?? null, identity.ownerHash],
    );
    if (!r.rowCount) throw new AccountError("NOT_FOUND", 404);
  });
}

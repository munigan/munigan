import type pg from "pg";
import type {
  ClaimResult,
  RequestIdentity,
  SaveIntent,
} from "@/domain/accounts/contracts";
import { authFlags } from "@/server/auth/config";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { AccountError } from "@/server/auth/errors";
import { requireAccount } from "@/server/auth/identity";
import { transaction } from "@/server/db/client";
import { capability, decrypt, digest } from "@/server/jobs/capabilities";
import { reportAccess } from "@/server/reports/access";
import {
  projectStoredReport,
  type StoredReport,
} from "@/server/reports/projection";
import { publishReport } from "./repository";

const validToken = (token: string) => /^[\w-]{43}$/.test(token);
function requireSaving() {
  if (!authFlags().savingEnabled)
    throw new AccountError("SAVING_UNAVAILABLE", 503);
}
type Job = {
  id: string;
  owner_hash: string;
  account_id: string | null;
  deleted_at: Date | null;
  expires_at: Date;
  db_now: Date;
  settled: boolean;
  status: string;
  report: StoredReport | null;
  token_cipher: string | null;
  has_library_item: boolean;
};
async function lockJob(
  client: pg.PoolClient,
  key: string,
  byId = false,
): Promise<Job> {
  const result = await client.query(
    `SELECT j.*,clock_timestamp() AS db_now,
 EXISTS(SELECT 1 FROM library_items li WHERE li.job_id=j.id AND li.user_id=j.account_id AND li.deleted_at IS NULL) AS has_library_item
 FROM tg_jobs j WHERE ${byId ? "j.id" : "j.token_hash"}=$1 FOR UPDATE OF j`,
    [key],
  );
  if (!result.rowCount) throw new AccountError("NOT_FOUND", 404);
  // Read time after the row lock is acquired, including any time spent waiting.
  const time = await client.query("SELECT clock_timestamp() AS db_now");
  return { ...result.rows[0], db_now: time.rows[0].db_now } as Job;
}
function validate(job: Job, identity: RequestIdentity) {
  if (job.deleted_at) throw new AccountError("NOT_FOUND", 404);
  const ownsCookie =
    identity.ownerHash !== null && identity.ownerHash === job.owner_hash;
  if (job.account_id ? identity.account?.id !== job.account_id : !ownsCookie)
    throw new AccountError(
      job.account_id && ownsCookie ? "CLAIM_CONFLICT" : "NOT_FOUND",
      job.account_id && ownsCookie ? 409 : 404,
    );
  const eligible =
    job.settled &&
    job.report !== null &&
    ["complete", "partial", "canceled"].includes(job.status) &&
    job.report.rows.length > 0;
  const retained = eligible && job.has_library_item;
  const access = reportAccess(
    {
      ownerHash: job.owner_hash,
      accountId: job.account_id,
      deletedAt: job.deleted_at,
      accountDeleting: false,
      retained,
      expiresAt: job.expires_at,
      eligible,
    },
    identity,
    job.db_now,
  );
  if (!retained && job.expires_at <= job.db_now)
    throw new AccountError("REPORT_EXPIRED", 410);
  if (!eligible) throw new AccountError("REPORT_NOT_READY", 409);
  if (!access.canManage) throw new AccountError("NOT_FOUND", 404);
}
async function claimLocked(
  client: pg.PoolClient,
  job: Job,
  identity: RequestIdentity,
): Promise<ClaimResult> {
  validate(job, identity);
  const account = requireAccount(identity);
  if (job.account_id === null) {
    const update = await client.query(
      "UPDATE tg_jobs SET account_id=$2 WHERE id=$1 AND account_id IS NULL AND deleted_at IS NULL",
      [job.id, account.id],
    );
    if (update.rowCount !== 1) throw new AccountError("CLAIM_CONFLICT", 409);
  }
  if (!job.token_cipher) throw new AccountError("NOT_FOUND", 404);
  const token = decrypt(job.token_cipher);
  const itemId = await publishReport(client, {
    jobId: job.id,
    userId: account.id,
    report: projectStoredReport(job.report!, token),
  });
  if (!itemId) throw new AccountError("REPORT_NOT_READY", 409);
  return { itemId, reportPath: `/reports/${token}` };
}
export async function beginSaveIntent(
  reportToken: string,
  identity: RequestIdentity,
): Promise<SaveIntent> {
  requireSaving();
  if (!validToken(reportToken) || !identity.ownerHash)
    throw new AccountError("NOT_FOUND", 404);
  return transaction(async (client) => {
    // Serialize this browser's cap across different reports. Prune before job locks.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 7))",
      [identity.ownerHash],
    );
    await client.query(
      "DELETE FROM report_save_intents WHERE owner_hash=$1 AND completed_at IS NULL AND expires_at<=clock_timestamp()",
      [identity.ownerHash],
    );
    const job = await lockJob(client, digest(reportToken));
    if (job.account_id !== null || job.owner_hash !== identity.ownerHash)
      throw new AccountError("NOT_FOUND", 404);
    validate(job, identity);
    const count = await client.query(
      "SELECT count(*)::int AS n FROM report_save_intents WHERE owner_hash=$1 AND completed_at IS NULL AND expires_at>clock_timestamp()",
      [identity.ownerHash],
    );
    if (count.rows[0].n >= 5) throw new AccountError("RATE_LIMITED", 429);
    const token = capability();
    const inserted = await client.query(
      "INSERT INTO report_save_intents(token_hash,job_id,owner_hash,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '10 minutes') RETURNING expires_at",
      [digest(token), job.id, identity.ownerHash],
    );
    return { token, expiresAt: inserted.rows[0].expires_at.toISOString() };
  });
}
export async function completeSaveIntent(
  intentToken: string,
  identity: RequestIdentity,
): Promise<ClaimResult> {
  const account = requireAccount(identity);
  if (!validToken(intentToken)) throw new AccountError("NOT_FOUND", 404);
  return transaction(async (client) => {
    await lockActiveAccount(client, account.id);
    const result = await client.query(
      "SELECT * FROM report_save_intents WHERE token_hash=$1 FOR UPDATE",
      [digest(intentToken)],
    );
    if (!result.rowCount) throw new AccountError("NOT_FOUND", 404);
    const intent = result.rows[0];
    if (!identity.ownerHash || intent.owner_hash !== identity.ownerHash)
      throw new AccountError("OWNER_COOKIE_REQUIRED", 409);
    const job = await lockJob(client, intent.job_id, true);
    if (job.owner_hash !== identity.ownerHash)
      throw new AccountError("OWNER_COOKIE_REQUIRED", 409);
    if (job.deleted_at) throw new AccountError("NOT_FOUND", 404);
    if (intent.completed_at && intent.completed_by !== account.id)
      throw new AccountError("CLAIM_CONFLICT", 409);
    if (!intent.completed_at && intent.expires_at <= job.db_now)
      throw new AccountError("INTENT_EXPIRED", 410);
    if (intent.completed_at && job.account_id !== account.id)
      throw new AccountError("CLAIM_CONFLICT", 409);
    if (intent.completed_at && !job.has_library_item)
      throw new AccountError("NOT_FOUND", 404);
    const claimed = await claimLocked(client, job, identity);
    if (!intent.completed_at) {
      const update = await client.query(
        "UPDATE report_save_intents SET completed_by=$2,completed_at=clock_timestamp() WHERE token_hash=$1 AND completed_at IS NULL",
        [digest(intentToken), account.id],
      );
      if (update.rowCount !== 1) throw new AccountError("CLAIM_CONFLICT", 409);
    }
    return claimed;
  });
}
export async function claimReport(
  reportToken: string,
  identity: RequestIdentity,
): Promise<ClaimResult> {
  requireSaving();
  const account = requireAccount(identity);
  if (!validToken(reportToken)) throw new AccountError("NOT_FOUND", 404);
  return transaction(async (client) => {
    await lockActiveAccount(client, account.id);
    return claimLocked(
      client,
      await lockJob(client, digest(reportToken)),
      identity,
    );
  });
}

import type { RequestIdentity } from "@/domain/accounts/contracts";
import type { TopGearReport } from "@/domain/top-gear/model";
import { pool } from "@/server/db/client";
import { AccountError } from "@/server/auth/errors";
import { digest } from "@/server/jobs/capabilities";
import { reportAccess } from "./access";
import {
  encodeReport,
  projectReport,
  projectStoredReport,
  type StoredReport,
} from "./projection";

const anonymousIdentity: RequestIdentity = { account: null, ownerHash: null };

export async function readReport(
  token: string,
  identity: RequestIdentity = anonymousIdentity,
): Promise<{
  jobId: string;
  report: TopGearReport;
  access: ReturnType<typeof reportAccess>;
  canManage: boolean;
  error: string | null;
}> {
  if (!/^[\w-]{43}$/.test(token)) throw new AccountError("NOT_FOUND", 404);
  const result = await pool.query(
    `SELECT j.*,
            now() AS db_now,
            coalesce(a.status='deleting',false) AS account_deleting,
            EXISTS(SELECT 1 FROM library_items li WHERE li.job_id=j.id AND li.deleted_at IS NULL) AS has_library_item
       FROM tg_jobs j
       LEFT JOIN account_lifecycle a ON a.user_id=j.account_id
      WHERE j.token_hash=$1`,
    [digest(token)],
  );
  if (!result.rowCount) throw new AccountError("NOT_FOUND", 404);
  const job = result.rows[0] as {
    id: string;
    owner_hash: string;
    account_id: string | null;
    deleted_at: Date | null;
    account_deleting: boolean;
    has_library_item: boolean;
    expires_at: Date;
    db_now: Date;
    status: TopGearReport["status"];
    settled: boolean;
    report: StoredReport | null;
    error: string | null;
  };
  const eligible =
    job.settled &&
    job.report !== null &&
    ["complete", "partial", "canceled"].includes(job.status) &&
    job.report.rows.length > 0;
  const retained = job.has_library_item && eligible;
  const access = reportAccess(
    {
      ownerHash: job.owner_hash,
      accountId: job.account_id,
      deletedAt: job.deleted_at,
      accountDeleting: job.account_deleting,
      retained,
      expiresAt: job.expires_at,
      eligible,
    },
    identity,
    job.db_now,
  );
  if (job.deleted_at || job.account_deleting)
    throw new AccountError("NOT_FOUND", 404);
  if (!retained && job.expires_at <= job.db_now)
    throw new AccountError("REPORT_EXPIRED", 410);
  const stored = job.report ?? encodeReport(await projectReport(job.id));
  const report = projectStoredReport(stored, token);
  return {
    jobId: job.id,
    report,
    access,
    canManage: access.canManage,
    error: job.error,
  };
}

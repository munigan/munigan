import { pool, transaction } from "@/server/db/client";
const eligible = `j.settled AND ((j.deleted_at IS NOT NULL AND j.scrubbed_at IS NULL) OR
 (j.deleted_at IS NULL AND j.expires_at<clock_timestamp()-interval '30 days'
 AND NOT EXISTS(SELECT 1 FROM library_items li WHERE li.job_id=j.id)
 AND NOT EXISTS(SELECT 1 FROM tg_jobs child WHERE child.prior_job=j.id)))`;
export async function cleanupReports(): Promise<{
  scrubbed: number;
  expired: number;
}> {
  const counts = { scrubbed: 0, expired: 0 };
  const candidates = await pool.query(
    `SELECT j.id,j.account_id,j.deleted_at FROM tg_jobs j WHERE ${eligible} ORDER BY j.created_at,j.id LIMIT 100`,
  );
  for (const candidate of candidates.rows) {
    const result = await transaction(async (c) => {
      if (candidate.account_id) {
        const account = await c.query(
          "SELECT user_id FROM account_lifecycle WHERE user_id=$1 FOR UPDATE SKIP LOCKED",
          [candidate.account_id],
        );
        if (!account.rowCount) return null;
      }
      // Physical deletion cascades into intents. Match completion's lifecycle ->
      // intent -> job order and defer a candidate with any busy intent.
      const intentLocks = candidate.deleted_at
        ? null
        : await c.query(
            "SELECT token_hash FROM report_save_intents WHERE job_id=$1 ORDER BY token_hash FOR UPDATE SKIP LOCKED",
            [candidate.id],
          );
      async function hasUnlockedIntents() {
        if (!intentLocks) return false;
        const result = await c.query(
          "SELECT 1 FROM report_save_intents WHERE job_id=$1 AND NOT (token_hash=ANY($2::text[])) LIMIT 1",
          [candidate.id, intentLocks.rows.map((row) => row.token_hash)],
        );
        return Boolean(result.rowCount);
      }
      if (await hasUnlockedIntents()) return null;
      const locked = await c.query(
        `SELECT j.id,j.account_id,j.deleted_at FROM tg_jobs j WHERE j.id=$1 AND ${eligible} FOR UPDATE OF j SKIP LOCKED`,
        [candidate.id],
      );
      const job = locked.rows[0];
      // A claim between candidate selection and locking requires a fresh pass with
      // the owning lifecycle lock; never acquire lifecycle while holding a job.
      if (!job || job.account_id !== candidate.account_id) return null;
      // Recheck after the lock: a save may have committed while SELECT waited.
      const rechecked = await c.query(
        `SELECT j.id FROM tg_jobs j WHERE j.id=$1 AND ${eligible}`,
        [job.id],
      );
      if (!rechecked.rowCount) return null;
      if (job.deleted_at) {
        await c.query("UPDATE tg_jobs SET prior_job=NULL WHERE prior_job=$1", [
          job.id,
        ]);
        await c.query("DELETE FROM tg_work WHERE job_id=$1", [job.id]);
        await c.query("DELETE FROM tg_outbox WHERE job_id=$1", [job.id]);
        await c.query(
          "UPDATE tg_jobs SET request=NULL,policy=NULL,plan=NULL,report=NULL,token_cipher=NULL,source_hash=NULL,error=NULL,admission_account_id=NULL,scrubbed_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
        return "scrubbed" as const;
      }
      // A begin-intent transaction could commit between the intent scan and
      // job lock. Never let the cascade acquire an uncoordinated intent lock.
      if (await hasUnlockedIntents()) return null;
      await c.query("DELETE FROM tg_jobs WHERE id=$1", [job.id]);
      return "expired" as const;
    });
    if (result) counts[result]++;
  }
  return counts;
}

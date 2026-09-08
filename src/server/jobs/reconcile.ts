import { pool, transaction } from "@/server/db/client";
import { settleQueuedJobs } from "./work";
export async function reconcileJobs() {
  await settleQueuedJobs();
  // A worker killed by its host cannot keep the job permanently running.
  await transaction(async (c) => {
    const jobs = await c.query(
      "SELECT id FROM tg_jobs WHERE status='running' AND lease_until<now()-interval '5 seconds' FOR UPDATE SKIP LOCKED",
    );
    for (const j of jobs.rows) {
      await c.query(
        "UPDATE tg_jobs SET status='queued',lease=NULL WHERE id=$1",
        [j.id],
      );
      await c.query(
        "UPDATE tg_outbox SET dispatched_at=NULL,next_attempt_at=now(),generation=generation+1 WHERE job_id=$1",
        [j.id],
      );
    }
  });
  // Keep a 30-day expiry grace period (410), then remove only settled unreferenced reports.
  await pool.query(
    "DELETE FROM tg_jobs j WHERE expires_at<now()-interval '30 days' AND settled AND NOT EXISTS(SELECT 1 FROM tg_jobs child WHERE child.prior_job=j.id)",
  );
}

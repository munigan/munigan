import { pool, transaction } from "@/server/db/client";
import { cleanupReports } from "@/server/reports/cleanup";
import { cleanupAccounts } from "@/server/accounts/deletion";
import { settleQueuedJobs } from "./work";
export async function reconcileJobs() {
  const failedPasses: string[] = [];
  async function pass<T>(
    name: string,
    run: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await run();
    } catch {
      // Exception objects may contain SQL, request payloads or connection credentials.
      failedPasses.push(name);
      console.error("Top Gear recovery pass failed", { pass: name });
      return null;
    }
  }
  await pass("settlement", settleQueuedJobs);
  await pass("leases", () =>
    transaction(async (c) => {
      const jobs = await c.query(
        "SELECT id FROM tg_jobs WHERE status='running' AND lease_until<now()-interval '5 seconds' LIMIT 100 FOR UPDATE SKIP LOCKED",
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
    }),
  );
  const reports = await pass("reports", cleanupReports);
  const accounts = await pass("accounts", cleanupAccounts);
  const deletion = await pass("deletion-age", async () => {
    const result = await pool.query(
      "SELECT extract(epoch FROM clock_timestamp()-min(deletion_requested_at))::float8 AS seconds FROM account_lifecycle WHERE status='deleting'",
    );
    return result.rows[0].seconds as number | null;
  });
  return { reports, accounts, oldestDeletionSeconds: deletion, failedPasses };
}

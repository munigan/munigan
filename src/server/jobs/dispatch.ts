import { tasks } from "@trigger.dev/sdk";
import { pool, transaction } from "@/server/db/client";
export async function dispatchPendingJobs() {
  if (!process.env.TRIGGER_SECRET_KEY || !process.env.TRIGGER_PROJECT_REF)
    throw new Error(
      "Set TRIGGER_PROJECT_REF and TRIGGER_SECRET_KEY before dispatching jobs",
    );
  const pending = await transaction(async (c) => {
    const rows = await c.query(
      "SELECT o.job_id,o.attempts,o.generation FROM tg_outbox o JOIN tg_jobs j ON j.id=o.job_id WHERE o.dispatched_at IS NULL AND o.next_attempt_at<=now() AND j.status='queued' ORDER BY j.created_at LIMIT 10 FOR UPDATE OF o SKIP LOCKED",
    );
    for (const row of rows.rows)
      await c.query(
        "UPDATE tg_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute' WHERE job_id=$1",
        [row.job_id],
      );
    return rows.rows;
  });
  let sent = 0;
  for (const row of pending) {
    try {
      await tasks.trigger(
        "top-gear",
        { jobId: row.job_id },
        {
          idempotencyKey: `top-gear-${row.job_id}-${row.generation}`,
          idempotencyKeyTTL: "7d",
        },
      );
      await acknowledgeDispatch(row.job_id, row.generation);
      sent++;
    } catch (e) {
      console.error(
        "Dispatch failed for job",
        row.job_id,
        e instanceof Error ? e.message : "provider error",
      );
    }
  }
  return sent;
}

export async function acknowledgeDispatch(jobId: string, generation: number) {
  const r = await pool.query(
    "UPDATE tg_outbox SET dispatched_at=now() WHERE job_id=$1 AND generation=$2",
    [jobId, generation],
  );
  return !!r.rowCount;
}

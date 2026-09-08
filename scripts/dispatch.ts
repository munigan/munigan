import { dispatchPendingJobs } from "../src/server/jobs/dispatch";
import { reconcileJobs } from "../src/server/jobs/reconcile";
import { pool } from "../src/server/db/client";
import { setTimeout } from "node:timers/promises";
const watch = process.argv.includes("--watch");
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => shutdown.abort());
try {
  if (watch) console.log("Trigger.dev dispatcher ready");
  do {
    try {
      await reconcileJobs();
      const sent = await dispatchPendingJobs();
      if (sent || !watch) console.log("Dispatched", sent, "jobs");
    } catch (error) {
      if (!watch) throw error;
      console.error(
        "Dispatch cycle failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    if (watch && !shutdown.signal.aborted)
      await setTimeout(2000, undefined, { signal: shutdown.signal }).catch(
        () => {},
      );
  } while (watch && !shutdown.signal.aborted);
} finally {
  await pool.end();
}

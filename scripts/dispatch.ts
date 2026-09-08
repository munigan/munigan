import { dispatchPendingJobs } from "../src/server/jobs/dispatch";
import { reconcileJobs } from "../src/server/jobs/reconcile";
import { pool } from "../src/server/db/client";
try {
  await reconcileJobs();
  console.log("Dispatched", await dispatchPendingJobs(), "jobs");
} finally {
  await pool.end();
}

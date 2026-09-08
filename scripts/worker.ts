import { setTimeout as delay } from "node:timers/promises";
import { settleQueuedJobs } from "../src/server/jobs/work";
import { executeTopGear } from "../src/server/jobs/work";
import { pool } from "../src/server/db/client";
const abort = new AbortController();
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, () => abort.abort());
console.log("Local Top Gear worker ready (shared concurrency: 2)");
async function loop() {
  while (!abort.signal.aborted) {
    try {
      await settleQueuedJobs();
      const ran = await executeTopGear(undefined, abort.signal);
      if (!ran) await delay(1000, undefined, { signal: abort.signal });
    } catch (e) {
      if (!abort.signal.aborted) {
        console.error(e instanceof Error ? e.message : e);
        await delay(2000);
      }
    }
  }
}
await Promise.all([loop(), loop()]);
await pool.end();

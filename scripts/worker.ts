import { setTimeout as delay } from "node:timers/promises";
import { settleQueuedJobs } from "../src/server/jobs/work";
import { executeTopGear } from "../src/server/jobs/work";
import { pool } from "../src/server/db/client";
import { limits, simulationConcurrency } from "../src/server/jobs/policy";
const abort = new AbortController();
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, () => abort.abort());
const jobSlots = limits().concurrency;
const simulationSlots = simulationConcurrency();
console.log(
  `Local Top Gear worker ready (${jobSlots} runs, ${simulationSlots} simulations per run)`,
);
async function loop() {
  while (!abort.signal.aborted) {
    try {
      await settleQueuedJobs();
      const ran = await executeTopGear(undefined, abort.signal, undefined, {
        concurrency: simulationSlots,
      });
      if (!ran) await delay(1000, undefined, { signal: abort.signal });
    } catch (e) {
      if (!abort.signal.aborted) {
        console.error(e instanceof Error ? e.message : e);
        await delay(2000);
      }
    }
  }
}
await Promise.all(Array.from({ length: jobSlots }, () => loop()));
await pool.end();

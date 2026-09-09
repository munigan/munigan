import { schedules } from "@trigger.dev/sdk";
import { reconcileJobs } from "@/server/jobs/reconcile";
import { dispatchPendingJobs } from "@/server/jobs/dispatch";

export const recoverTopGear = schedules.task({
  id: "top-gear-recovery",
  // Immediate submissions dispatch from Vercel. Ten-minute recovery allows
  // the free database to suspend between sweeps when no one is using the app.
  cron: { pattern: "*/10 * * * *", environments: ["PRODUCTION"] },
  queue: { concurrencyLimit: 1 },
  maxDuration: 60,
  run: async () => {
    await reconcileJobs();
    return { dispatched: await dispatchPendingJobs() };
  },
});

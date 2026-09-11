import { logger, task } from "@trigger.dev/sdk";
import { executeTargetedJob, rescheduleQueuedJob } from "@/server/jobs/work";
import { simulationQueue } from "./queues";
export const topGearTask = task({
  id: "top-gear",
  queue: simulationQueue,
  machine: "medium-2x",
  maxDuration: 960,
  retry: { maxAttempts: 2, minTimeoutInMs: 35000, maxTimeoutInMs: 40000 },
  onFailure: async ({ payload }: { payload: { jobId: string } }) => {
    await rescheduleQueuedJob(payload.jobId);
  },
  run: async (payload: { jobId: string }, { signal, ctx }) => {
    if (!/^[a-f0-9-]{36}$/.test(payload.jobId))
      throw new Error("Invalid job ID");
    await executeTargetedJob(payload.jobId, signal, {
      concurrency: Math.max(1, Math.min(2, Math.floor(ctx.machine.cpu))),
      onPerformance: (measurement) => {
        logger.info("Top Gear performance", {
          ...measurement,
          machine: ctx.machine.name,
        });
      },
    });
  },
});

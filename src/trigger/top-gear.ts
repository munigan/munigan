import { task } from "@trigger.dev/sdk";
import { executeTargetedJob, rescheduleQueuedJob } from "@/server/jobs/work";
import { simulationQueue } from "./queues";
export const topGearTask = task({
  id: "top-gear",
  queue: simulationQueue,
  maxDuration: 960,
  retry: { maxAttempts: 2, minTimeoutInMs: 35000, maxTimeoutInMs: 40000 },
  onFailure: async ({ payload }: { payload: { jobId: string } }) => {
    await rescheduleQueuedJob(payload.jobId);
  },
  run: async (payload: { jobId: string }, { signal }) => {
    if (!/^[a-f0-9-]{36}$/.test(payload.jobId))
      throw new Error("Invalid job ID");
    await executeTargetedJob(payload.jobId, signal);
  },
});

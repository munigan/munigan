import { after } from "next/server";
import { dispatchPendingJobs } from "./dispatch";

/** The outbox is already durable. A provider outage must not undo admission. */
export function wakeDispatcher() {
  if (!process.env.TRIGGER_SECRET_KEY || !process.env.TRIGGER_PROJECT_REF)
    return;
  after(async () => {
    try {
      await dispatchPendingJobs();
    } catch {
      console.error(
        "Immediate dispatch unavailable; queued jobs await recovery.",
      );
    }
  });
}

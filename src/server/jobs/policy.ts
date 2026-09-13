import type { WorkPolicy } from "@/domain/top-gear/model";
function integer(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${name}`);
  return n;
}
export function unlimitedLocalAdmission() {
  return (
    process.env.APP_ENV === "local" &&
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_UNLIMITED_ADMISSION === "1"
  );
}
export function workPolicy(requestedIterations?: number): WorkPolicy {
  const unlimited = unlimitedLocalAdmission();
  const iterations = requestedIterations ?? integer("TOP_GEAR_ITERATIONS", 500);
  if (requestedIterations !== undefined && !unlimited)
    throw new Error("Custom iterations are only available in local testing");
  if (
    unlimited &&
    (!Number.isSafeInteger(iterations) ||
      iterations < 500 ||
      iterations > 6000 ||
      iterations % 500 !== 0)
  )
    throw new Error(
      "Local iterations must be between 500 and 6000 in steps of 500",
    );
  if (
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV !== "local" &&
    !process.env.TOP_GEAR_MAX_UNITS
  )
    throw new Error("Production admission limits have not been configured");
  return {
    version: unlimited ? "unlimited-local-v1" : "uniform-local-v1",
    unitsPerSet: 5000,
    maxUnits: unlimited ? null : integer("TOP_GEAR_MAX_UNITS", 600000),
    iterationsPerSet: iterations,
    maxSearchNodes: unlimited ? null : 100000,
    maxJobSeconds: unlimited ? null : integer("TOP_GEAR_MAX_SECONDS", 900),
    ...(unlimited
      ? { selectableIterations: { min: 500, max: 6000, step: 500 } }
      : {}),
    maxAttempts: 2,
  };
}
export const limits = () => ({
  unlimited: unlimitedLocalAdmission(),
  dailyUnits: integer("GLOBAL_DAILY_UNITS", 10000000),
  backlog: integer("MAX_QUEUED_JOBS", 20),
  accountActive: 2,
  accountDaily: 20,
  ownerActive: 2,
  ownerDaily: 20,
  concurrency: 2,
});

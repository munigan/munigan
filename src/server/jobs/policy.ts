import type { WorkPolicy } from "@/domain/top-gear/model";
function integer(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${name}`);
  return n;
}
export function workPolicy(): WorkPolicy {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV !== "local" &&
    !process.env.TOP_GEAR_MAX_UNITS
  )
    throw new Error("Production admission limits have not been configured");
  return {
    version: "uniform-local-v1",
    unitsPerSet: 5000,
    maxUnits: integer("TOP_GEAR_MAX_UNITS", 600000),
    iterationsPerSet: integer("TOP_GEAR_ITERATIONS", 500),
    maxSearchNodes: 100000,
    maxJobSeconds: integer("TOP_GEAR_MAX_SECONDS", 900),
    maxAttempts: 2,
  };
}
export const limits = () => ({
  dailyUnits: integer("GLOBAL_DAILY_UNITS", 10000000),
  backlog: integer("MAX_QUEUED_JOBS", 20),
  accountActive: 2,
  accountDaily: 20,
  ownerActive: 2,
  ownerDaily: 20,
  concurrency: 2,
});

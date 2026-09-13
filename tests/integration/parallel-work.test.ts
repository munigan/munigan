import { readReport } from "@/server/reports/read";
import { digest } from "@/server/jobs/capabilities";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "@/server/db/client";
import { admitJob } from "@/server/jobs/admit";
import { executeTopGear, type ExecutionPerformance } from "@/server/jobs/work";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { fixtureRequest } from "../support/fixtures";
import { planRun } from "@/domain/equipment/enumerate";
import { workPolicy } from "@/server/jobs/policy";

process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(async () => {
  await createTestDatabase();
});
beforeEach(async () => {
  await pool.query("TRUNCATE tg_jobs, tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});

async function createJob(candidateCount = 3) {
  const request = fixtureRequest();
  for (const [index, gem] of [39996, 40112, 40022, 40111]
    .slice(0, candidateCount)
    .entries()) {
    const instanceId = `bag-head-${index}`;
    request.snapshot.inventory.push({
      instanceId,
      itemId: 40528,
      enchantId: 3817,
      gemIds: [41285, gem],
      source: "bag",
    });
    request.selection.selectedInstanceIds.push(instanceId);
  }
  const ownerKey = randomUUID();
  return {
    ...(await admitJob({
      request: encodeRequest(request),
      ownerKey,
      idempotencyKey: randomUUID(),
    })),
    ownerKey,
    request,
  };
}

const result: NonNullable<Parameters<typeof executeTopGear>[2]> = async (
  _snapshot,
  loadout,
  iterations,
  seed,
  _signal,
  isReference,
) => ({
  loadout,
  isReference,
  inputHash: seed,
  metric: { mean: Number(seed), stdev: 100, iterations },
  stats: [],
});

it("persists the reference first and fills two slots as candidates finish out of order", async () => {
  const job = await createJob();
  const controller = new AbortController();
  const gates = Array.from({ length: 3 }, () => Promise.withResolvers<void>());
  const started: string[] = [];
  let active = 0,
    peak = 0,
    referencePersisted = true;
  const pending = executeTopGear(
    job.jobId,
    controller.signal,
    async (...args) => {
      if (!args[5]) {
        const head = args[1].head!;
        const reference = await pool.query(
          "SELECT result FROM tg_work WHERE job_id=$1 AND result->>'isReference'='true'",
          [job.jobId],
        );
        referencePersisted &&= reference.rowCount === 1;
        active++;
        peak = Math.max(peak, active);
        started.push(head);
        await gates[Number(head.at(-1))].promise;
        active--;
      }
      return result(...args);
    },
    { concurrency: 2 },
  );
  try {
    await expect
      .poll(() => [...started], { timeout: 1500 })
      .toEqual(["bag-head-0", "bag-head-1"]);
    gates[1].resolve();
    await expect
      .poll(() => [...started], { timeout: 1500 })
      .toEqual(["bag-head-0", "bag-head-1", "bag-head-2"]);
    expect(active).toBe(2);
  } finally {
    gates.forEach((g) => g.resolve());
    await pending;
  }
  expect(peak).toBe(2);
  expect(referencePersisted).toBe(true);
  const { report } = await readReport(job.reportToken, {
    account: null,
    ownerHash: digest(job.ownerKey),
  });
  expect(report.status).toBe("complete");
  expect(report.equippedId).toBe("100000");
  expect(report.rows.map((r) => [r.id, r.iterations])).toEqual([
    ["101503", 500],
    ["101002", 500],
    ["100501", 500],
    ["100000", 500],
  ]);
  expect(report.coverage).toMatchObject({
    planned: 4,
    succeeded: 4,
    failed: 0,
    exhaustive: true,
  });
});

it("awaits every aborted child before settling cancellation and leaves queued candidates unattempted", async () => {
  const job = await createJob();
  const controller = new AbortController();
  const cleanup = Promise.withResolvers<void>();
  let active = 0,
    interrupted = 0;
  const pending = executeTopGear(
    job.jobId,
    controller.signal,
    async (...args) => {
      if (args[5]) return result(...args);
      active++;
      await new Promise<void>((resolve) => {
        if (args[4].aborted) resolve();
        else args[4].addEventListener("abort", () => resolve(), { once: true });
      });
      interrupted++;
      await cleanup.promise;
      active--;
      throw new Error("Simulation canceled");
    },
    { concurrency: 2 },
  );
  try {
    await expect.poll(() => active, { timeout: 1500 }).toBe(2);
    controller.abort();
    await expect.poll(() => interrupted).toBe(2);
    expect(
      (
        await pool.query("SELECT status,settled FROM tg_jobs WHERE id=$1", [
          job.jobId,
        ])
      ).rows[0],
    ).toEqual({ status: "running", settled: false });
  } finally {
    controller.abort();
    cleanup.resolve();
    await pending;
  }
  expect(active).toBe(0);
  const { report } = await readReport(job.reportToken, {
    account: null,
    ownerHash: digest(job.ownerKey),
  });
  expect(report.status).toBe("canceled");
  expect(report.coverage.succeeded).toBe(1);
  expect(
    (
      await pool.query(
        "SELECT sum(attempts)::int attempts FROM tg_work WHERE job_id=$1",
        [job.jobId],
      )
    ).rows[0].attempts,
  ).toBe(3);
  expect(
    (await pool.query("SELECT reserved::int,spent::int FROM tg_budgets"))
      .rows[0],
  ).toEqual({ reserved: 0, spent: 15000 });
});

it("aborts siblings and drains them before recording an admission failure", async () => {
  const job = await createJob();
  await pool.query(`CREATE FUNCTION fail_third_work() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (SELECT count(*) FROM tg_work WHERE job_id=NEW.job_id)>=2 THEN
        RAISE EXCEPTION 'Admission database unavailable';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER fail_third_work BEFORE INSERT ON tg_work FOR EACH ROW EXECUTE FUNCTION fail_third_work()`);
  const controller = new AbortController();
  const cleanup = Promise.withResolvers<void>();
  let interrupted = false;
  const pending = executeTopGear(
    job.jobId,
    controller.signal,
    async (...args) => {
      if (args[5]) return result(...args);
      await new Promise<void>((resolve) => {
        if (args[4].aborted) resolve();
        else args[4].addEventListener("abort", () => resolve(), { once: true });
      });
      interrupted = true;
      await cleanup.promise;
      throw new Error("Simulation canceled");
    },
    { concurrency: 2 },
  );
  try {
    await expect.poll(() => interrupted, { timeout: 1500 }).toBe(true);
    expect(
      (
        await pool.query("SELECT status,settled FROM tg_jobs WHERE id=$1", [
          job.jobId,
        ])
      ).rows[0],
    ).toEqual({ status: "running", settled: false });
  } finally {
    cleanup.resolve();
    if (!interrupted) controller.abort();
    await pending;
    await pool.query(
      "DROP TRIGGER fail_third_work ON tg_work; DROP FUNCTION fail_third_work()",
    );
  }
  const { report, error } = await readReport(job.reportToken, {
    account: null,
    ownerHash: digest(job.ownerKey),
  });
  expect(report.status).toBe("partial");
  expect(report.termination).toBe("failed");
  expect(error).toMatch(/Admission database unavailable/);
});

it("fences all active candidates after lease loss and allows a new worker to resume durable work", async () => {
  const job = await createJob();
  const controller = new AbortController();
  let active = 0;
  const pending = executeTopGear(
    job.jobId,
    controller.signal,
    async (...args) => {
      if (args[5]) return result(...args);
      active++;
      try {
        await new Promise<void>((resolve) => {
          if (args[4].aborted) resolve();
          else
            args[4].addEventListener("abort", () => resolve(), { once: true });
        });
        // Model a child that finishes as the lease is lost: its result must be fenced.
        return result(...args);
      } finally {
        active--;
      }
    },
    { concurrency: 2 },
  );
  const newLease = randomUUID();
  try {
    await expect.poll(() => active, { timeout: 1500 }).toBe(2);
    await pool.query("UPDATE tg_jobs SET lease=$2 WHERE id=$1", [
      job.jobId,
      newLease,
    ]);
    await expect.poll(() => active, { timeout: 2000 }).toBe(0);
  } finally {
    controller.abort();
    await pending;
  }
  const state = await pool.query(
    "SELECT status,settled,lease,report FROM tg_jobs WHERE id=$1",
    [job.jobId],
  );
  expect(state.rows[0]).toEqual({
    status: "running",
    settled: false,
    lease: newLease,
    report: null,
  });
  expect(
    (
      await pool.query(
        "SELECT count(*)::int count FROM tg_work WHERE job_id=$1 AND result IS NOT NULL",
        [job.jobId],
      )
    ).rows[0].count,
  ).toBe(1);

  await pool.query(
    "UPDATE tg_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
    [job.jobId],
  );
  const measurements: ExecutionPerformance[] = [];
  await executeTopGear(job.jobId, new AbortController().signal, result, {
    concurrency: 2,
    onPerformance: (measurement) => measurements.push(measurement),
  });
  const { report } = await readReport(job.reportToken, {
    account: null,
    ownerHash: digest(job.ownerKey),
  });
  expect(report.status).toBe("complete");
  expect(report.coverage.succeeded).toBe(4);
  expect(measurements[0]).toMatchObject({
    planned: 4,
    attempts: 3,
    succeeded: 3,
    concurrency: 2,
    leaseLost: false,
    timedOut: false,
    iterationsPerSet: 500,
  });
  expect(
    (
      await pool.query(
        "SELECT result->>'inputHash' seed,attempts FROM tg_work WHERE job_id=$1 ORDER BY result->>'inputHash'",
        [job.jobId],
      )
    ).rows,
  ).toEqual([
    { seed: "100000", attempts: 1 },
    { seed: "100501", attempts: 2 },
    { seed: "101002", attempts: 2 },
    { seed: "101503", attempts: 1 },
  ]);
});

it("keeps parallel retries within each set's frozen attempt cap", async () => {
  const job = await createJob();
  const measurements: ExecutionPerformance[] = [];
  const attempted = new Set<string>();
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (...args) => {
      if (args[3] === "100501" && !attempted.has(args[3])) {
        attempted.add(args[3]);
        throw Object.assign(new Error("Temporary resource failure"), {
          code: "EAGAIN",
        });
      }
      if (args[3] === "101002")
        throw Object.assign(new Error("Persistent resource failure"), {
          code: "EAGAIN",
        });
      return result(...args);
    },
    {
      concurrency: 2,
      onPerformance: (measurement) => measurements.push(measurement),
    },
  );
  const { report } = await readReport(job.reportToken, {
    account: null,
    ownerHash: digest(job.ownerKey),
  });
  expect(report.status).toBe("partial");
  expect(report.coverage).toMatchObject({
    planned: 4,
    succeeded: 3,
    failed: 1,
    exhaustive: false,
  });
  const plan = planRun(
    job.request.snapshot,
    job.request.selection,
    workPolicy(),
  );
  const work = await pool.query(
    "SELECT work_key,attempts FROM tg_work WHERE job_id=$1",
    [job.jobId],
  );
  const attempts = new Map(
    work.rows.map((row) => [row.work_key, row.attempts]),
  );
  expect(plan.simulations.map((sim) => attempts.get(sim.key))).toEqual([
    1, 2, 2, 1,
  ]);
  expect(measurements[0]).toMatchObject({ attempts: 6, succeeded: 3 });
  expect(measurements[0].phaseMs.admission).toBeGreaterThan(0);
  expect(measurements[0].phaseMs.persistence).toBeGreaterThan(0);
  expect(measurements[0].elapsedMs).toBeGreaterThan(0);
});

it("fills four local simulation slots without exceeding the configured concurrency", async () => {
  const job = await createJob(4);
  const gate = Promise.withResolvers<void>();
  let active = 0;
  let peak = 0;
  const execution = executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (...args) => {
      if (!args[5]) {
        active++;
        peak = Math.max(peak, active);
        await gate.promise;
        active--;
      }
      return result(...args);
    },
    { concurrency: 4 },
  );
  try {
    await expect.poll(() => active, { timeout: 2000 }).toBe(4);
  } finally {
    gate.resolve();
    await execution;
  }
  expect(peak).toBe(4);
});

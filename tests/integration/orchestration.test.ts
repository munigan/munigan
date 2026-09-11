import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { pool, testSchema } from "@/server/db/client";
import { admitJob, cancelJob } from "@/server/jobs/admit";
import { executeTopGear, readReport } from "@/server/jobs/work";
import { fixtureRequest } from "../support/fixtures";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { randomUUID } from "node:crypto";
import { Stat } from "@/generated/wotlk/common";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query(await readFile("drizzle/0000_top_gear.sql", "utf8"));
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA ${testSchema} CASCADE`);
  await pool.end();
});
it("refreshes legacy recommendations from all stored results without rewriting the report", async () => {
  const request = fixtureRequest();
  request.snapshot.inventory.push({
    instanceId: "bag-head",
    itemId: 40528,
    enchantId: 3817,
    gemIds: [41285, 39996],
    source: "bag",
  });
  request.selection.selectedInstanceIds.push("bag-head");
  const ownerKey = randomUUID();
  const job = await admitJob({
    request: encodeRequest(request),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (_snapshot, loadout, iterations) => {
      const capped = loadout.head !== "bag-head";
      const stats = Array(40).fill(0);
      stats[Stat.StatMeleeHit] = 1000;
      stats[Stat.StatExpertise] = capped ? 1000 : 0;
      return {
        loadout,
        inputHash: capped ? "capped" : "highest",
        stats,
        metric: { mean: capped ? 10000 : 10001, stdev: 100, iterations },
      };
    },
  );
  const { report } = await readReport(job.reportToken, ownerKey);
  expect(report.highestId).toBe("highest");
  expect(report.recommendedId).toBe("capped");
  const stored = { ...report, recommendedId: "highest" };
  await pool.query("UPDATE tg_jobs SET report=$2 WHERE id=$1", [
    job.jobId,
    JSON.stringify(stored),
  ]);
  expect(
    (await readReport(job.reportToken, ownerKey)).report.recommendedId,
  ).toBe("capped");
  expect(
    (await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [job.jobId]))
      .rows[0].report,
  ).toEqual(stored);
});
it("persists every set and duplicate delivery does not rerun completed work", async () => {
  const owner = randomUUID();
  const job = await admitJob({
    request: encodeRequest(fixtureRequest()),
    ownerKey: owner,
    idempotencyKey: randomUUID(),
  });
  let calls = 0;
  const evaluator: Parameters<typeof executeTopGear>[2] = async (_s, l, i) => {
    calls++;
    return {
      loadout: l,
      inputHash: `result-${calls}`,
      metric: { mean: 10000 + calls, stdev: 100, iterations: i },
      stats: [],
    };
  };
  await executeTopGear(job.jobId, new AbortController().signal, evaluator);
  const count = calls;
  await executeTopGear(job.jobId, new AbortController().signal, evaluator);
  expect(calls).toBe(count);
  const report = await readReport(job.reportToken, owner);
  expect(report.report.status).toBe("complete");
  expect(report.report.coverage.exhaustive).toBe(true);
  expect(report.report.rows).toHaveLength(calls);
  expect(report.canManage).toBe(true);
});
it("cancels queued work without executing or losing a budget reservation", async () => {
  const owner = randomUUID(),
    job = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: owner,
      idempotencyKey: randomUUID(),
    });
  await cancelJob(job.jobId, owner);
  await executeTopGear(job.jobId, new AbortController().signal, async () => {
    throw new Error("Must not execute");
  });
  expect((await readReport(job.reportToken, owner)).report.status).toBe(
    "canceled",
  );
  const state = await pool.query("SELECT settled FROM tg_jobs WHERE id=$1", [
    job.jobId,
  ]);
  expect(state.rows[0].settled).toBe(true);
});
it("groups historical ring permutations on read without changing the stored report", async () => {
  const owner = randomUUID();
  const request = fixtureRequest();
  const job = await admitJob({
    request: encodeRequest(request),
    ownerKey: owner,
    idempotencyKey: randomUUID(),
  });
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (_s, loadout, iterations) => ({
      loadout,
      inputHash: "baseline",
      metric: { mean: 10000, stdev: 100, iterations },
      stats: [],
    }),
  );
  const { report } = await readReport(job.reportToken, owner);
  const baseline = report.rows[0];
  const swapped = {
    ...baseline,
    id: "old-swapped",
    inputHash: "old-swapped",
    isEquipped: false,
    dps: 10020,
    gain: 20,
    loadout: {
      ...baseline.loadout,
      finger1: baseline.loadout.finger2,
      finger2: baseline.loadout.finger1,
    },
  };
  const stored = {
    ...report,
    rows: [swapped, baseline],
    highestId: swapped.id,
  };
  await pool.query("UPDATE tg_jobs SET report=$2 WHERE id=$1", [
    job.jobId,
    JSON.stringify(stored),
  ]);
  const projected = await readReport(job.reportToken, owner);
  expect(projected.report.rows).toHaveLength(1);
  expect(projected.report.rows[0]).toMatchObject({
    dps: 10000,
    gain: 0,
    isEquipped: true,
  });
  expect(projected.report.highestId).toBe(projected.report.equippedId);
  expect(
    (await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [job.jobId]))
      .rows[0].report,
  ).toEqual(stored);
});
it("retains completed rows when cancellation interrupts the next set", async () => {
  const request = fixtureRequest();
  request.snapshot.inventory.push({
    instanceId: "bag-head",
    itemId: 40528,
    enchantId: 3817,
    gemIds: [41285, 39996],
    source: "bag",
  });
  request.selection.selectedInstanceIds.push("bag-head");
  const owner = randomUUID(),
    job = await admitJob({
      request: encodeRequest(request),
      ownerKey: owner,
      idempotencyKey: randomUUID(),
    });
  let calls = 0;
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (_s, l, i, _seed, signal) => {
      if (++calls === 1)
        return {
          loadout: l,
          inputHash: "equipped",
          metric: { mean: 10000, stdev: 100, iterations: i },
          stats: [],
        };
      await cancelJob(job.jobId, owner);
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("canceled")), {
          once: true,
        }),
      );
    },
  );
  const data = await readReport(job.reportToken, owner);
  expect(data.report.status).toBe("canceled");
  expect(data.report.coverage.succeeded).toBe(1);
  expect(data.report.coverage.exhaustive).toBe(false);
});
it("settles queued expiry without an available CPU worker", async () => {
  const { reconcileJobs } = await import("@/server/jobs/reconcile");
  const owner = randomUUID(),
    job = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: owner,
      idempotencyKey: randomUUID(),
    });
  await pool.query(
    "UPDATE tg_jobs SET created_at=now()-interval '31 minutes' WHERE id=$1",
    [job.jobId],
  );
  await reconcileJobs();
  const state = await pool.query(
    "SELECT settled,status FROM tg_jobs WHERE id=$1",
    [job.jobId],
  );
  expect(state.rows[0]).toEqual({ settled: true, status: "canceled" });
  expect(
    (await readReport(job.reportToken, owner)).report.coverage.succeeded,
  ).toBe(0);
});
it("retries a transient native infrastructure failure within the work attempt cap", async () => {
  const owner = randomUUID(),
    job = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: owner,
      idempotencyKey: randomUUID(),
    });
  let calls = 0;
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (_s, l, i) => {
      if (++calls === 1)
        throw Object.assign(new Error("Resource temporarily unavailable"), {
          code: "EAGAIN",
        });
      return {
        loadout: l,
        inputHash: `retry-${calls}`,
        metric: { mean: 10000, stdev: 100, iterations: i },
        stats: [],
      };
    },
  );
  expect((await readReport(job.reportToken, owner)).report.status).toBe(
    "complete",
  );
  const attempts = await pool.query(
    "SELECT max(attempts) count FROM tg_work WHERE job_id=$1",
    [job.jobId],
  );
  expect(attempts.rows[0].count).toBe(2);
});
it("keeps enhancement-only reference and candidate rows distinct through worker persistence and report reads", async () => {
  const request = fixtureRequest();
  const legs = request.snapshot.inventory.find(
    (item) => item.equippedSlot === "legs",
  )!;
  request.snapshot.gemming = undefined;
  request.snapshot.autoEnchant = false;
  request.snapshot.itemEnhancements = {
    [legs.instanceId]: { gemIds: [40112, 0], enchantId: 0 },
  };
  const ownerKey = randomUUID();
  const job = await admitJob({
    request: encodeRequest(request),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  const { simulationInput } = await import("@/server/simulator/evaluate");
  const { prepareGems } = await import("@/domain/equipment/gemming");
  const { prepareEnchants } = await import("@/domain/equipment/enhancements");
  const seen: number[][] = [];
  await executeTopGear(
    job.jobId,
    new AbortController().signal,
    async (snapshot, loadout, iterations, seed, _signal, reference) => {
      const input = simulationInput(
        snapshot,
        loadout,
        iterations,
        seed,
        reference,
      );
      seen.push(input.raid!.parties[0].players[0].equipment!.items[8].gems);
      return {
        isReference: reference,
        loadout,
        gemOverrides: reference ? {} : prepareGems(snapshot, loadout).overrides,
        enchantOverrides: reference
          ? {}
          : prepareEnchants(snapshot, loadout).overrides,
        inputHash: reference
          ? "enhancement-reference"
          : "enhancement-candidate",
        metric: { mean: reference ? 1000 : 1100, stdev: 1, iterations },
        stats: [],
      };
    },
  );
  expect(seen).toEqual([
    [39996, 40022],
    [40112, 0],
  ]);
  const { report } = await readReport(job.reportToken, ownerKey);
  expect(report.status).toBe("complete");
  expect(report.rows).toHaveLength(2);
  expect(report.equippedId).toBe("enhancement-reference");
  expect(report.highestId).toBe("enhancement-candidate");
  expect(
    report.rows.find((row) => row.id === "enhancement-candidate"),
  ).toMatchObject({
    isEquipped: false,
    gain: 100,
    gemOverrides: { [legs.instanceId]: [40112, 0] },
  });
});

it("does not acknowledge a targeted job refused by active database leases", async () => {
  const { executeTargetedJob, rescheduleQueuedJob } =
    await import("@/server/jobs/work");
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const job = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
    });
    ids.push(job.jobId);
  }
  await pool.query(
    "UPDATE tg_jobs SET status='running',lease=$2,lease_until=now()+interval '30 seconds' WHERE id=ANY($1::uuid[])",
    [ids.slice(0, 2), randomUUID()],
  );
  await pool.query("UPDATE tg_outbox SET dispatched_at=now() WHERE job_id=$1", [
    ids[2],
  ]);
  await expect(
    executeTargetedJob(ids[2], new AbortController().signal),
  ).rejects.toThrow(/capacity/);
  await rescheduleQueuedJob(ids[2]);
  const outbox = await pool.query(
    "SELECT dispatched_at,generation FROM tg_outbox WHERE job_id=$1",
    [ids[2]],
  );
  expect(outbox.rows[0]).toEqual({ dispatched_at: null, generation: 1 });
});
it("ignores a stale dispatch acknowledgment after rescheduling", async () => {
  const { acknowledgeDispatch } = await import("@/server/jobs/dispatch");
  const { rescheduleQueuedJob } = await import("@/server/jobs/work");
  const job = await admitJob({
    request: encodeRequest(fixtureRequest()),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  await rescheduleQueuedJob(job.jobId);
  expect(await acknowledgeDispatch(job.jobId, 0)).toBe(false);
  const record = await pool.query(
    "SELECT dispatched_at FROM tg_outbox WHERE job_id=$1",
    [job.jobId],
  );
  expect(record.rows[0].dispatched_at).toBe(null);
  expect(await acknowledgeDispatch(job.jobId, 1)).toBe(true);
});

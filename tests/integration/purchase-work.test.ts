import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { admitJob } from "@/server/jobs/admit";
import { executeTopGear, retryJob } from "@/server/jobs/work";
import {
  encodeRequest,
  decodeSnapshot,
} from "@/domain/top-gear/request-schema";
import { purchaseFixture } from "../support/purchase-fixtures";
import { readReport } from "@/server/reports/read";
import {
  projectStoredReport,
  type StoredReport,
} from "@/server/reports/projection";
import { digest } from "@/server/jobs/capabilities";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE tg_jobs,tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
const evaluator: NonNullable<Parameters<typeof executeTopGear>[2]> = async (
  snapshot,
  loadout,
  iterations,
  seed,
  _signal,
  isReference,
) => {
  for (const id of Object.values(loadout).filter(Boolean))
    expect(snapshot.inventory.some((i) => i.instanceId === id)).toBe(true);
  return {
    loadout,
    isReference,
    inputHash: seed,
    metric: { mean: Number(seed), stdev: 1, iterations },
    stats: [],
  };
};
it("hydrates frozen candidates, retains partial costs and resumes with the baseline exactly once", async () => {
  const ownerKey = randomUUID(),
    identity = { account: null, ownerHash: digest(ownerKey) };
  const admitted = await admitJob({
    request: encodeRequest(purchaseFixture({ frost: 100 })),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  let attempts = 0;
  await executeTopGear(admitted.jobId, undefined, async (...args) => {
    if (++attempts > 3) throw new Error("unsupported");
    return evaluator(...args);
  });
  const { report } = await readReport(admitted.reportToken, identity);
  expect(report.status).toBe("partial");
  expect(report.purchases?.inputs.balances).toEqual({ frost: 100 });
  expect(report.rows).toHaveLength(3);
  expect(report.rows.every((r) => r.purchasePlan !== undefined)).toBe(true);
  const stored = (
    await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [admitted.jobId])
  ).rows[0].report as StoredReport;
  expect(
    decodeSnapshot(stored.snapshot).inventory.some(
      (i) => i.source === "purchase",
    ),
  ).toBe(true);
  expect(
    decodeSnapshot(stored.purchases!.originalSnapshot).inventory.some(
      (i) => i.source === "purchase",
    ),
  ).toBe(false);
  const duplicate = projectStoredReport(
    { ...stored, rows: [...stored.rows, stored.rows[0]] },
    "token",
  );
  expect(duplicate.rows).toHaveLength(3);
  expect(duplicate.rows.every((r) => r.purchasePlan !== undefined)).toBe(true);
  const retry = await retryJob(
    admitted.jobId,
    identity,
    randomUUID(),
    ownerKey,
  );
  let references = 0;
  await executeTopGear(retry.jobId, undefined, async (...args) => {
    if (args[5]) references++;
    return evaluator(...args);
  });
  const final = await readReport(retry.reportToken, identity);
  expect(final.report.status).toBe("complete");
  expect(final.report.coverage.planned).toBe(11);
  expect(final.report.rows.every((r) => r.purchasePlan !== undefined)).toBe(
    true,
  );
  expect(references).toBe(0);
});
it("fails explicitly when a purchase job loses its frozen plan", async () => {
  const admitted = await admitJob({
    request: encodeRequest(purchaseFixture({ frost: 100 })),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  await pool.query("UPDATE tg_jobs SET plan=NULL WHERE id=$1", [
    admitted.jobId,
  ]);
  let evaluated = 0;
  await executeTopGear(admitted.jobId, undefined, async (...args) => {
    evaluated++;
    return evaluator(...args);
  });
  const job = (
    await pool.query("SELECT status,error,settled FROM tg_jobs WHERE id=$1", [
      admitted.jobId,
    ])
  ).rows[0];
  expect(evaluated).toBe(0);
  expect(job).toMatchObject({
    status: "failed",
    settled: true,
    error: expect.stringMatching(/frozen purchase plan/i),
  });
});
it("keeps purchase metadata in selected pages and pinned report rows", async () => {
  const { GET } = await import("@/app/api/reports/[token]/route");
  const { NextRequest } = await import("next/server");
  const admitted = await admitJob({
    request: encodeRequest(
      purchaseFixture({ frost: 100, "regalia:vanquisher": 1 }),
    ),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  await executeTopGear(admitted.jobId, undefined, evaluator);
  const response = await GET(
    new NextRequest(
      `http://localhost/api/reports/${admitted.reportToken}?cursor=20`,
    ),
    { params: Promise.resolve({ token: admitted.reportToken }) },
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.report.rows).toHaveLength(20);
  expect(data.totalRows).toBe(101);
  expect(data.pinnedRows.length).toBeGreaterThan(0);
  expect(
    [...data.report.rows, ...data.pinnedRows].every(
      (r: { purchasePlan?: unknown }) => r.purchasePlan !== undefined,
    ),
  ).toBe(true);
  expect(
    decodeSnapshot(data.report.purchases.originalSnapshot).settings.player,
  ).toBeDefined();
});
it("resumes a lease-expired frozen job without re-running its durable reference", async () => {
  const admitted = await admitJob({
    request: encodeRequest(purchaseFixture({ frost: 100 })),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  const job = (
    await pool.query("SELECT plan,request FROM tg_jobs WHERE id=$1", [
      admitted.jobId,
    ])
  ).rows[0];
  const work = job.plan.simulations[0];
  const result = await evaluator(
    decodeSnapshot(job.request.snapshot),
    work.loadout,
    work.iterations,
    work.seed,
    new AbortController().signal,
    true,
  );
  await pool.query(
    "INSERT INTO tg_work(job_id,work_key,result) VALUES($1,$2,$3)",
    [admitted.jobId, work.key, JSON.stringify(result)],
  );
  job.request.purchases.recipeRevision = "old-deployment";
  await pool.query(
    "UPDATE tg_jobs SET status='running',lease_until=now()-interval '1 minute',request=$2 WHERE id=$1",
    [admitted.jobId, JSON.stringify(job.request)],
  );
  let count = 0;
  await executeTopGear(admitted.jobId, undefined, async (...args) => {
    expect(args[5]).toBe(false);
    count++;
    return evaluator(...args);
  });
  expect(count).toBe(10);
  expect((await readReport(admitted.reportToken)).report.status).toBe(
    "complete",
  );
});
it.each(["simulations", "duplicate-generated"])(
  "settles a malformed frozen purchase plan (%s) without simulation",
  async (damage) => {
    const admitted = await admitJob({
      request: encodeRequest(purchaseFixture({ frost: 100 })),
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
    });
    const job = (
      await pool.query("SELECT plan FROM tg_jobs WHERE id=$1", [admitted.jobId])
    ).rows[0];
    if (damage === "simulations") delete job.plan.simulations;
    else
      job.plan.purchases.generatedItems.push(
        job.plan.purchases.generatedItems[0],
      );
    await pool.query("UPDATE tg_jobs SET plan=$2 WHERE id=$1", [
      admitted.jobId,
      JSON.stringify(job.plan),
    ]);
    let count = 0;
    await executeTopGear(admitted.jobId, undefined, async (...args) => {
      count++;
      return evaluator(...args);
    });
    expect(count).toBe(0);
    const state = (
      await pool.query("SELECT status,settled,error FROM tg_jobs WHERE id=$1", [
        admitted.jobId,
      ])
    ).rows[0];
    expect(state).toMatchObject({
      status: "failed",
      settled: true,
      error: expect.stringMatching(/frozen purchase plan/i),
    });
  },
);

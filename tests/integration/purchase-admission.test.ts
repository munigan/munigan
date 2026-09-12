import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { admitJob } from "@/server/jobs/admit";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { purchaseFixture } from "../support/purchase-fixtures";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { workPolicy } from "@/server/jobs/policy";
import { digest } from "@/server/jobs/capabilities";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE tg_jobs,tg_budgets CASCADE");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
const args = () => ({
  request: encodeRequest(
    purchaseFixture({ frost: 100, "regalia:vanquisher": 1 }),
  ),
  ownerKey: randomUUID(),
  idempotencyKey: randomUUID(),
});
async function stored(id: string) {
  return (await pool.query("SELECT * FROM tg_jobs WHERE id=$1", [id])).rows[0];
}
it("freezes the 101 affordable simulations and costs before reserving", async () => {
  vi.stubEnv("TOP_GEAR_MAX_UNITS", String(101 * 5000));
  const admitted = await admitJob(args());
  const job = await stored(admitted.jobId);
  expect(job.plan?.simulations).toHaveLength(101);
  expect(job.plan.allowance.count).toBe(101);
  expect(job.plan.purchases.inputs.balances).toEqual({
    frost: 100,
    "regalia:vanquisher": 1,
  });
  expect(
    job.request.snapshot.inventory.some(
      (i: { source: string }) => i.source === "purchase",
    ),
  ).toBe(false);
  expect(Number(job.reserved)).toBe(101 * 5000 * workPolicy().maxAttempts);
});
it("returns an exact intent after a recipe revision changes, but rejects a changed wallet", async () => {
  const input = args();
  const admitted = await admitJob(input);
  const stale = structuredClone(input.request);
  stale.purchases!.recipeRevision = "old-deployment";
  await pool.query(
    "UPDATE tg_jobs SET request=$2,request_hash=$3 WHERE id=$1",
    [admitted.jobId, JSON.stringify(stale), digest(JSON.stringify(stale))],
  );
  expect(getPurchaseCatalog("original").revision).not.toBe("old-deployment");
  expect(await admitJob({ ...input, request: stale })).toEqual(admitted);
  stale.purchases!.balances.frost = 120;
  await expect(admitJob({ ...input, request: stale })).rejects.toMatchObject({
    status: 409,
  });
});
it("reuses authorized frozen retries while enforcing the current allowance and schedule", async () => {
  const input = args();
  const prior = await admitJob(input);
  const previous = await stored(prior.jobId);
  input.request.purchases!.recipeRevision = "old-deployment";
  await pool.query(
    "UPDATE tg_jobs SET request=$2,status='failed' WHERE id=$1",
    [prior.jobId, JSON.stringify(input.request)],
  );
  vi.stubEnv("TOP_GEAR_MAX_UNITS", "5000");
  await expect(
    admitJob({ ...input, idempotencyKey: randomUUID(), priorJob: prior.jobId }),
  ).rejects.toMatchObject({
    status: 422,
    diagnostic: { code: "purchaseAllowanceExceeded" },
  });
  vi.stubEnv("TOP_GEAR_MAX_UNITS", "600000");
  vi.stubEnv("TOP_GEAR_ITERATIONS", "200");
  const retry = await admitJob({
    ...input,
    idempotencyKey: randomUUID(),
    priorJob: prior.jobId,
  });
  const job = await stored(retry.jobId);
  expect(job.plan.purchases).toEqual(previous.plan.purchases);
  expect(job.plan.simulations[1]).toMatchObject({
    iterations: 200,
    seed: "100201",
  });
  expect(job.plan.allowance.count).toBe(101);
  await expect(
    admitJob({
      ...input,
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
      priorJob: prior.jobId,
    }),
  ).rejects.toMatchObject({ status: 404 });
  input.request.purchases!.balances.frost = 120;
  await expect(
    admitJob({ ...input, idempotencyKey: randomUUID(), priorJob: prior.jobId }),
  ).rejects.toMatchObject({ code: "purchaseCatalogChanged" });
});
it("rejects unaffordable, stale, and forged new inputs without budget reservation", async () => {
  vi.stubEnv("TOP_GEAR_MAX_UNITS", "5000");
  await expect(admitJob(args())).rejects.toMatchObject({
    status: 422,
    diagnostic: { code: "purchaseAllowanceExceeded" },
  });
  const stale = args();
  stale.request.purchases!.recipeRevision = "old";
  await expect(admitJob(stale)).rejects.toMatchObject({
    code: "purchaseCatalogChanged",
  });
  const forged = args();
  forged.request.snapshot.inventory[0].source = "purchase";
  await expect(admitJob(forged)).rejects.toThrow();
  expect((await pool.query("SELECT * FROM tg_budgets")).rowCount).toBe(0);
  expect((await pool.query("SELECT * FROM tg_jobs")).rowCount).toBe(0);
});
it("returns a targeted definitive enhancement rejection and accepts explicit defaults", async () => {
  const request = purchaseFixture({ frost: 100 });
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom");
  request.snapshot.itemEnhancements = { custom: { gemIds: [9999999] } };
  const input = { ownerKey: randomUUID(), idempotencyKey: randomUUID() };
  await expect(
    admitJob({ ...input, request: encodeRequest(request) }),
  ).rejects.toMatchObject({
    status: 422,
    diagnostic: {
      code: "purchaseEnhancementInvalid",
      params: { itemId: 50098 },
    },
  });
  request.purchases!.itemEnhancements.original = { "50098": {} };
  const admitted = await admitJob({
    ...input,
    request: encodeRequest(request),
  });
  expect(
    (await stored(admitted.jobId)).request.snapshot.itemEnhancements.custom,
  ).toEqual({ gemIds: [9999999] });
});
it("rejects an unavailable locked purchase and respects expired retry permissions", async () => {
  const request = purchaseFixture({ frost: 0 });
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom");
  request.selection.lockedSlots.shoulder = "custom";
  await expect(
    admitJob({
      request: encodeRequest(request),
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({
    status: 422,
    diagnostic: { code: "purchaseNoLegalSets" },
  });
  expect((await pool.query("SELECT * FROM tg_budgets")).rowCount).toBe(0);
  const input = args(),
    prior = await admitJob(input);
  await pool.query(
    "UPDATE tg_jobs SET status='failed',expires_at=now()-interval '1 second' WHERE id=$1",
    [prior.jobId],
  );
  await expect(
    admitJob({ ...input, idempotencyKey: randomUUID(), priorJob: prior.jobId }),
  ).rejects.toMatchObject({ status: 410 });
});
it("gives invalid inherited raw custom gems a targeted error and preserves them after reset", async () => {
  const request = purchaseFixture({ frost: 100 });
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    source: "custom",
    gemIds: [9999999],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom");
  const input = { ownerKey: randomUUID(), idempotencyKey: randomUUID() };
  await expect(
    admitJob({ ...input, request: encodeRequest(request) }),
  ).rejects.toMatchObject({
    status: 422,
    diagnostic: {
      code: "purchaseEnhancementInvalid",
      params: { itemId: 50098 },
    },
  });
  request.purchases!.itemEnhancements.original = { "50098": {} };
  const admitted = await admitJob({
    ...input,
    request: encodeRequest(request),
  });
  expect(
    (await stored(admitted.jobId)).request.snapshot.inventory.find(
      (i: { instanceId: string }) => i.instanceId === "custom",
    ).gemIds,
  ).toEqual([9999999]);
});
it("reports a bounded search rejection before reserving resources", async () => {
  const policies = await import("@/server/jobs/policy");
  const spy = vi
    .spyOn(policies, "workPolicy")
    .mockReturnValue({ ...policies.workPolicy(), maxSearchNodes: 1 });
  try {
    await expect(admitJob(args())).rejects.toMatchObject({
      status: 422,
      diagnostic: { code: "purchaseSearchLimit" },
    });
    expect((await pool.query("SELECT * FROM tg_budgets")).rowCount).toBe(0);
  } finally {
    spy.mockRestore();
  }
});
it("replans changed-wallet retries and serializes identical purchase intents", async () => {
  const input = {
    ...args(),
    request: encodeRequest(purchaseFixture({ frost: 100 })),
  };
  const [a, b] = await Promise.all([admitJob(input), admitJob(input)]);
  expect(a).toEqual(b);
  expect((await pool.query("SELECT * FROM tg_jobs")).rowCount).toBe(1);
  await pool.query("UPDATE tg_jobs SET status='failed' WHERE id=$1", [a.jobId]);
  input.request.purchases!.balances.frost = 120;
  const retry = await admitJob({
    ...input,
    idempotencyKey: randomUUID(),
    priorJob: a.jobId,
  });
  const job = await stored(retry.jobId);
  expect(job.plan.simulations).toHaveLength(15);
  expect(job.plan.purchases.inputs.balances).toEqual({ frost: 120 });
  expect((await stored(a.jobId)).plan.purchases.inputs.balances).toEqual({
    frost: 100,
  });
});

it.each([
  "negative balance",
  "fractional balance",
  "client costs",
  "reserved inventory ID",
])("rejects %s at admission without reserving job or budget", async (kind) => {
  const input = args();
  if (kind === "negative balance") input.request.purchases!.balances.frost = -1;
  if (kind === "fractional balance")
    input.request.purchases!.balances.frost = 1.5;
  if (kind === "client costs")
    Object.assign(input.request.purchases!, { spent: { frost: 0 } });
  if (kind === "reserved inventory ID") {
    const id = "purchase-original-48504";
    input.request.snapshot.inventory[0].instanceId = id;
    input.request.snapshot.equipped.legs = id;
    input.request.selection.selectedInstanceIds = [id];
  }
  await expect(admitJob(input)).rejects.toThrow();
  expect((await pool.query("SELECT * FROM tg_jobs")).rowCount).toBe(0);
  expect((await pool.query("SELECT * FROM tg_budgets")).rowCount).toBe(0);
});

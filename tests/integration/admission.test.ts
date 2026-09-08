import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import { pool, testSchema } from "@/server/db/client";
import { admitJob, cancelJob } from "@/server/jobs/admit";
import { fixtureRequest } from "../support/fixtures";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { randomUUID } from "node:crypto";
import { estimateAllowance, loadoutKey } from "@/domain/equipment/enumerate";
import { itemVersions } from "@/domain/top-gear/item-version";
import { digest } from "@/server/jobs/capabilities";
import { workPolicy } from "@/server/jobs/policy";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query(await readFile("drizzle/0000_top_gear.sql", "utf8"));
});
beforeEach(async () => {
  await pool.query("TRUNCATE tg_jobs, tg_budgets CASCADE");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await pool.query(`DROP SCHEMA ${testSchema} CASCADE`);
  await pool.end();
});
it("reuses legacy Classic work only for the same Classic request", async () => {
  const request = fixtureRequest();
  request.snapshot.itemVersion = "classic";
  request.snapshot.itemDataRevision = itemVersions.classic.revision;
  const ownerKey = randomUUID(),
    idempotencyKey = randomUUID();
  const prior = await admitJob({
    request: encodeRequest(request),
    ownerKey,
    idempotencyKey,
  });
  const legacy = encodeRequest(request);
  delete legacy.snapshot.itemVersion;
  delete legacy.snapshot.itemDataRevision;
  await pool.query(
    "UPDATE tg_jobs SET request=$2,request_hash=$3,status='failed' WHERE id=$1",
    [prior.jobId, JSON.stringify(legacy), digest(JSON.stringify(legacy))],
  );
  const key = loadoutKey(request.snapshot, request.snapshot.equipped);
  const result = {
    loadout: request.snapshot.equipped,
    inputHash: "legacy-result",
    metric: {
      mean: 9000,
      stdev: 100,
      iterations: workPolicy().iterationsPerSet,
    },
    stats: [],
  };
  await pool.query(
    "INSERT INTO tg_work(job_id,work_key,result) VALUES($1,$2,$3)",
    [prior.jobId, key.slice(key.indexOf("[")), JSON.stringify(result)],
  );
  expect(
    await admitJob({
      request: encodeRequest(request),
      ownerKey,
      idempotencyKey,
    }),
  ).toEqual(prior);
  const retry = await admitJob({
    request: legacy,
    ownerKey,
    idempotencyKey: randomUUID(),
    priorJob: prior.jobId,
  });
  expect(
    (
      await pool.query("SELECT work_key,result FROM tg_work WHERE job_id=$1", [
        retry.jobId,
      ])
    ).rows,
  ).toEqual([{ work_key: key, result }]);
  request.snapshot.itemVersion = "original";
  request.snapshot.itemDataRevision = itemVersions.original.revision;
  const originalRun = await admitJob({
    request: encodeRequest(request),
    ownerKey,
    idempotencyKey: randomUUID(),
    priorJob: prior.jobId,
  });
  expect(
    (
      await pool.query("SELECT * FROM tg_work WHERE job_id=$1", [
        originalRun.jobId,
      ])
    ).rowCount,
  ).toBe(0);
  const old = await pool.query("SELECT request FROM tg_jobs WHERE id=$1", [
    prior.jobId,
  ]);
  expect(old.rows[0].request.snapshot.itemVersion).toBeUndefined();
});
it("reserves once for simultaneous retries and rejects changed request under the same key", async () => {
  const args = {
    request: encodeRequest(fixtureRequest()),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  };
  const [a, b] = await Promise.all([admitJob(args), admitJob(args)]);
  expect(a).toEqual(b);
  const rows = await pool.query("SELECT * FROM tg_jobs WHERE id=$1", [a.jobId]);
  expect(rows.rowCount).toBe(1);
  args.request.selection.lockedSlots.head = args.request.snapshot.equipped.head;
  await expect(admitJob(args)).rejects.toThrow(/different/i);
  expect(await cancelJob(a.jobId, "someone-else")).toBe(false);
  expect(await cancelJob(a.jobId, args.ownerKey)).toBe(true);
});

it("serializes distinct submissions so only one can reserve the remaining daily budget", async () => {
  const request = fixtureRequest();
  const policy = workPolicy();
  const reservation =
    estimateAllowance(request.snapshot, request.selection, policy).units *
    policy.maxAttempts;
  vi.stubEnv("GLOBAL_DAILY_UNITS", String(reservation));
  const submissions = await Promise.allSettled(
    [1, 2].map(() =>
      admitJob({
        request: encodeRequest(request),
        ownerKey: randomUUID(),
        idempotencyKey: randomUUID(),
      }),
    ),
  );
  expect(submissions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = submissions.find((r) => r.status === "rejected");
  expect(rejected?.reason).toMatchObject({ status: 503 });
  const budget = await pool.query("SELECT reserved,spent FROM tg_budgets");
  expect(Number(budget.rows[0].reserved)).toBe(reservation);
  expect(Number(budget.rows[0].spent)).toBe(0);
  expect((await pool.query("SELECT * FROM tg_outbox")).rowCount).toBe(1);
});

it("refuses a full queue without a new budget reservation or outbox entry", async () => {
  vi.stubEnv("MAX_QUEUED_JOBS", "1");
  const request = encodeRequest(fixtureRequest());
  await admitJob({
    request,
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  const before = await pool.query("SELECT reserved FROM tg_budgets");
  await expect(
    admitJob({ request, ownerKey: randomUUID(), idempotencyKey: randomUUID() }),
  ).rejects.toMatchObject({ status: 503 });
  expect((await pool.query("SELECT reserved FROM tg_budgets")).rows).toEqual(
    before.rows,
  );
  expect((await pool.query("SELECT * FROM tg_outbox")).rowCount).toBe(1);
});

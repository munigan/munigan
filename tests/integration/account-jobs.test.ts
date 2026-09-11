import { AccountError } from "@/server/auth/errors";
import { getIdentity } from "@/server/auth/identity";
import { NextRequest } from "next/server";
import type { AccountIdentity } from "@/domain/accounts/contracts";
import { POST as jobsPOST } from "@/app/api/top-gear/jobs/route";
import { POST as retryPOST } from "@/app/api/top-gear/jobs/[id]/retry/route";
import { GET as reportGET } from "@/app/api/reports/[token]/route";
let sessionAccount: AccountIdentity | null = null;
vi.mock("@/server/auth/identity", async (original) => ({
  ...(await original<typeof import("@/server/auth/identity")>()),
  getIdentity: vi.fn(async (req: NextRequest) => ({
    account: sessionAccount,
    ownerHash: req.cookies.get("tg_owner")?.value
      ? digest(req.cookies.get("tg_owner")!.value)
      : null,
  })),
}));
vi.mock("@/server/jobs/wake", () => ({ wakeDispatcher: () => {} }));
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
  afterEach,
} from "vitest";
import { pool } from "@/server/db/client";
import { admitJob, cancelJob } from "@/server/jobs/admit";
import { executeTopGear, retryJob } from "@/server/jobs/work";
import { capability, digest } from "@/server/jobs/capabilities";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { seedAccount } from "../support/accounts";
import { fixtureRequest } from "../support/fixtures";
import { createTestDatabase, dropTestDatabase } from "../support/database";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
afterEach(() => {
  sessionAccount = null;
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  await pool.query("TRUNCATE auth_user,tg_jobs,tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
const request = () => encodeRequest(fixtureRequest());
const evaluator: Parameters<typeof executeTopGear>[2] = async (
  _s,
  loadout,
  iterations,
  seed,
) => ({
  loadout,
  inputHash: seed,
  metric: { mean: 10000, stdev: 10, iterations },
  stats: [],
});
it("associates admission and publishes without a browser even when saving is disabled", async () => {
  const account = await seedAccount(),
    ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: digest(ownerKey) },
  });
  expect(
    (
      await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
        job.jobId,
      ])
    ).rows[0].account_id,
  ).toBe(account.id);
  await executeTopGear(job.jobId, undefined, evaluator);
  await executeTopGear(job.jobId, undefined, evaluator);
  expect(
    (
      await pool.query("SELECT * FROM library_items WHERE job_id=$1", [
        job.jobId,
      ])
    ).rowCount,
  ).toBe(1);
});
it("rejects reusing a browser token across accounts or admission modes", async () => {
  const account = await seedAccount(),
    other = await seedAccount(),
    ownerKey = capability();
  const args = { request: request(), ownerKey, idempotencyKey: randomUUID() };
  await admitJob({
    ...args,
    identity: { account, ownerHash: digest(ownerKey) },
  });
  await expect(
    admitJob({
      ...args,
      identity: { account: other, ownerHash: digest(ownerKey) },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(admitJob(args)).rejects.toMatchObject({ status: 409 });
});
it("retries from another browser with stable replay and rejects deleted prior reports before replay", async () => {
  const account = await seedAccount(),
    ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: digest(ownerKey) },
  });
  await executeTopGear(job.jobId, undefined, async () => {
    throw new Error("failure");
  });
  const newOwner = capability(),
    identity = { account, ownerHash: digest(newOwner) },
    key = randomUUID();
  const retry = await retryJob(job.jobId, identity, key, newOwner);
  expect(await retryJob(job.jobId, identity, key, newOwner)).toEqual(retry);
  await pool.query("UPDATE tg_jobs SET deleted_at=now() WHERE id=$1", [
    job.jobId,
  ]);
  await expect(
    retryJob(job.jobId, identity, key, newOwner),
  ).rejects.toMatchObject({ status: 404 });
});
it.each(["complete", "partial", "canceled", "failed"])(
  "publishes eligible %s results once",
  async (status) => {
    const account = await seedAccount(),
      ownerKey = capability(),
      input = fixtureRequest();
    input.snapshot.inventory.push({
      instanceId: "bag-head",
      itemId: 40528,
      enchantId: 3817,
      gemIds: [41285, 39996],
      source: "bag",
    });
    input.selection.selectedInstanceIds.push("bag-head");
    const job = await admitJob({
      request: encodeRequest(input),
      ownerKey,
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: digest(ownerKey) },
    });
    const abort = new AbortController();
    let calls = 0;
    await executeTopGear(job.jobId, abort.signal, async (...args) => {
      calls++;
      if (status === "failed" || (status === "partial" && calls > 1))
        throw new Error("failed");
      if (status === "canceled" && calls > 1) {
        abort.abort();
        throw new Error("canceled");
      }
      return evaluator!(...args);
    });
    await executeTopGear(job.jobId, undefined, evaluator);
    expect(
      (
        await pool.query("SELECT status,settled FROM tg_jobs WHERE id=$1", [
          job.jobId,
        ])
      ).rows[0],
    ).toEqual({ status, settled: true });
    expect(
      (
        await pool.query("SELECT * FROM library_items WHERE job_id=$1", [
          job.jobId,
        ])
      ).rowCount,
    ).toBe(status === "failed" ? 0 : 1);
  },
);
it("rolls publication failure back and recovers settlement", async () => {
  const account = await seedAccount(),
    ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: digest(ownerKey) },
  });
  await pool.query("CREATE SEQUENCE publication_attempt");
  await pool.query(
    "CREATE FUNCTION reject_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('publication_attempt')=1 THEN RAISE EXCEPTION 'injected publication failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_publication BEFORE INSERT ON library_items FOR EACH ROW EXECUTE FUNCTION reject_publication()",
  );
  try {
    await expect(
      executeTopGear(job.jobId, undefined, evaluator),
    ).rejects.toThrow("injected publication failure");
    expect(
      (await pool.query("SELECT settled FROM tg_jobs WHERE id=$1", [job.jobId]))
        .rows[0].settled,
    ).toBe(false);
  } finally {
    await pool.query("DROP TRIGGER reject_publication ON library_items");
    await pool.query("DROP FUNCTION reject_publication()");
    await pool.query("DROP SEQUENCE publication_attempt");
  }
  await pool.query(
    "UPDATE tg_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
    [job.jobId],
  );
  await executeTopGear(job.jobId, undefined, evaluator);
  expect(
    (await pool.query("SELECT settled FROM tg_jobs WHERE id=$1", [job.jobId]))
      .rows[0].settled,
  ).toBe(true);
  expect(
    (
      await pool.query("SELECT * FROM library_items WHERE job_id=$1", [
        job.jobId,
      ])
    ).rowCount,
  ).toBe(1);
});
it("counts account quotas across browser cookies including deleted daily skeletons", async () => {
  const account = await seedAccount();
  for (let i = 0; i < 2; i++)
    await admitJob({
      request: request(),
      ownerKey: capability(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    });
  await expect(
    admitJob({
      request: request(),
      ownerKey: capability(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    }),
  ).rejects.toMatchObject({ status: 429 });
  for (let i = 2; i < 20; i++) {
    await pool.query(
      "UPDATE tg_jobs SET status='failed',settled=true,deleted_at=now()",
    );
    await admitJob({
      request: request(),
      ownerKey: capability(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    });
  }
  await pool.query(
    "UPDATE tg_jobs SET status='failed',settled=true,deleted_at=now()",
  );
  await expect(
    admitJob({
      request: request(),
      ownerKey: capability(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    }),
  ).rejects.toMatchObject({ status: 429 });
});

const httpRequest = (
  url: string,
  payload: unknown,
  ownerKey = capability(),
  key = randomUUID(),
) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      cookie: `tg_owner=${ownerKey}`,
      "idempotency-key": key,
    },
    body: JSON.stringify(payload),
  });
it("requires an account for explicit saving and honors explicit anonymous admission", async () => {
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  expect(
    (
      await jobsPOST(
        httpRequest("/api/top-gear/jobs", {
          ...request(),
          authMode: "account",
        }),
      )
    ).status,
  ).toBe(401);
  sessionAccount = await seedAccount();
  const saved = await jobsPOST(
    httpRequest("/api/top-gear/jobs", { ...request(), authMode: "account" }),
  );
  expect(saved.status).toBe(202);
  expect(
    (
      await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
        (await saved.json()).jobId,
      ])
    ).rows[0].account_id,
  ).toBe(sessionAccount.id);
  const anonymous = await jobsPOST(
    httpRequest("/api/top-gear/jobs", { ...request(), authMode: "anonymous" }),
  );
  expect(anonymous.status).toBe(202);
  expect(
    (
      await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
        (await anonymous.json()).jobId,
      ])
    ).rows[0].account_id,
  ).toBeNull();
  vi.stubEnv("REPORT_SAVING_ENABLED", "false");
  expect(
    (
      await jobsPOST(
        httpRequest("/api/top-gear/jobs", {
          ...request(),
          authMode: "account",
        }),
      )
    ).status,
  ).toBe(503);
  expect(
    (
      await jobsPOST(
        httpRequest("/api/top-gear/jobs", { ...request(), authMode: "bad" }),
      )
    ).status,
  ).toBe(400);
});
it("initializes a fresh browser on report GET then supports account retry and uncertain-response replay", async () => {
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  sessionAccount = await seedAccount();
  const ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account: sessionAccount, ownerHash: digest(ownerKey) },
  });
  await executeTopGear(job.jobId, undefined, async () => {
    throw new Error("failed");
  });
  const response = await reportGET(
    new NextRequest(`http://localhost/api/reports/${job.reportToken}`),
    { params: Promise.resolve({ token: job.reportToken }) },
  );
  expect(response.status).toBe(200);
  const cookie = response.cookies.get("tg_owner")!.value;
  expect(cookie).toMatch(/^[\w-]{43}$/);
  const key = randomUUID(),
    retry = () =>
      retryPOST(
        httpRequest(`/api/top-gear/jobs/${job.jobId}/retry`, {}, cookie, key),
        { params: Promise.resolve({ id: job.jobId }) },
      );
  const first = await retry();
  expect(first.status).toBe(202);
  const replay = await retry();
  expect(replay.status).toBe(202);
  expect(await replay.json()).toEqual(await first.json());
});
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLifecycleWait() {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const waiting = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE 'SELECT status FROM account_lifecycle%FOR UPDATE'",
    );
    if (waiting.rowCount) return;
  }
  throw new Error("Worker did not wait for lifecycle lock");
}
it.each(["complete", "partial", "canceled", "failed"])(
  "account tombstone serializes before %s settlement",
  async (status) => {
    const account = await seedAccount(),
      ownerKey = capability(),
      input = fixtureRequest();
    input.snapshot.inventory.push({
      instanceId: "bag-head",
      itemId: 40528,
      enchantId: 3817,
      gemIds: [41285, 39996],
      source: "bag",
    });
    input.selection.selectedInstanceIds.push("bag-head");
    const job = await admitJob({
      request: encodeRequest(input),
      ownerKey,
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: digest(ownerKey) },
    });
    const entered = barrier(),
      release = barrier(),
      abort = new AbortController();
    let calls = 0;
    const running = executeTopGear(job.jobId, abort.signal, async (...args) => {
      calls++;
      if (calls === 1) {
        entered.resolve();
        await release.promise;
      }
      if (status === "failed" || (status === "partial" && calls > 1))
        throw new Error("failed");
      if (status === "canceled" && calls > 1) {
        abort.abort();
        throw new Error("canceled");
      }
      return evaluator!(...args);
    });
    await entered.promise;
    const deletion = await pool.connect();
    try {
      await deletion.query("BEGIN");
      await deletion.query(
        "SELECT status FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
        [account.id],
      );
      release.resolve();
      await waitForLifecycleWait();
      await deletion.query(
        "UPDATE account_lifecycle SET status='deleting' WHERE user_id=$1",
        [account.id],
      );
      await deletion.query(
        "UPDATE tg_jobs SET deleted_at=now(),report=NULL WHERE id=$1",
        [job.jobId],
      );
      await deletion.query("COMMIT");
      await running;
    } finally {
      await deletion.query("ROLLBACK");
      deletion.release();
      release.resolve();
    }
    expect(
      (
        await pool.query(
          "SELECT settled,report,status FROM tg_jobs WHERE id=$1",
          [job.jobId],
        )
      ).rows[0],
    ).toEqual({ settled: true, report: null, status: "canceled" });
    expect(
      (
        await pool.query("SELECT * FROM library_items WHERE job_id=$1", [
          job.jobId,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (await pool.query("SELECT reserved,spent FROM tg_budgets")).rows[0],
    ).toMatchObject({ reserved: "0" });
    await executeTopGear(job.jobId, undefined, evaluator);
  },
);
it("checks settled before decoding scrubbed payload after an in-flight duplicate", async () => {
  const account = await seedAccount(),
    ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: digest(ownerKey) },
  });
  const entered = barrier(),
    release = barrier();
  const running = executeTopGear(job.jobId, undefined, async () => {
    entered.resolve();
    await release.promise;
    throw new Error("duplicate");
  });
  await entered.promise;
  await pool.query(
    "UPDATE tg_jobs SET settled=true,deleted_at=now(),scrubbed_at=now(),request=NULL,policy=NULL,plan=NULL,report=NULL WHERE id=$1",
    [job.jobId],
  );
  release.resolve();
  await running;
  expect(
    (await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [job.jobId]))
      .rows[0].report,
  ).toBeNull();
});

it("fails closed on unavailable authentication, resolves legacy identity, and never accepts a user ID", async () => {
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  vi.mocked(getIdentity).mockRejectedValueOnce(
    new AccountError("AUTH_UNAVAILABLE", 503),
  );
  const unavailable = await jobsPOST(
    httpRequest("/api/top-gear/jobs", { ...request(), authMode: "account" }),
  );
  expect(unavailable.status).toBe(503);
  expect((await pool.query("SELECT * FROM tg_jobs")).rowCount).toBe(0);
  sessionAccount = await seedAccount();
  const legacy = await jobsPOST(httpRequest("/api/top-gear/jobs", request()));
  expect(legacy.status).toBe(202);
  expect(
    (
      await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
        (await legacy.json()).jobId,
      ])
    ).rows[0].account_id,
  ).toBe(sessionAccount.id);
  expect(
    (
      await jobsPOST(
        httpRequest("/api/top-gear/jobs", { ...request(), userId: "other" }),
      )
    ).status,
  ).toBe(422);
});
it("does not change an original anonymous admission into account admission after a claim", async () => {
  const account = await seedAccount(),
    ownerKey = capability(),
    args = { request: request(), ownerKey, idempotencyKey: randomUUID() };
  const job = await admitJob(args);
  await pool.query("UPDATE tg_jobs SET account_id=$2 WHERE id=$1", [
    job.jobId,
    account.id,
  ]);
  await expect(
    admitJob({ ...args, identity: { account, ownerHash: digest(ownerKey) } }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(admitJob(args)).rejects.toMatchObject({ status: 409 });
});

it("allows cross-device account cancellation but refuses the original browser without the owning account", async () => {
  const account = await seedAccount(),
    other = await seedAccount(),
    ownerKey = capability();
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: digest(ownerKey) },
  });
  await expect(
    cancelJob(job.jobId, { account: other, ownerHash: digest(ownerKey) }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    cancelJob(job.jobId, { account: null, ownerHash: digest(ownerKey) }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    cancelJob(job.jobId, { account, ownerHash: null }),
  ).resolves.toBeUndefined();
  expect(
    (
      await pool.query("SELECT cancel_requested FROM tg_jobs WHERE id=$1", [
        job.jobId,
      ])
    ).rows[0].cancel_requested,
  ).toBe(true);
});
it("rejects expiry before replaying a retry token", async () => {
  const ownerKey = capability(),
    identity = { account: null, ownerHash: digest(ownerKey) };
  const job = await admitJob({
    request: request(),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  await executeTopGear(job.jobId, undefined, async () => {
    throw new Error("failed");
  });
  const key = randomUUID();
  await retryJob(job.jobId, identity, key, ownerKey);
  await pool.query(
    "UPDATE tg_jobs SET expires_at=now()-interval '1 second' WHERE id=$1",
    [job.jobId],
  );
  await expect(
    retryJob(job.jobId, identity, key, ownerKey),
  ).rejects.toMatchObject({ code: "REPORT_EXPIRED", status: 410 });
});

it.each(["", "   "])(
  "settles an admitted unnamed report %j with display-only fallback",
  async (name) => {
    const account = await seedAccount(),
      ownerKey = capability(),
      input = fixtureRequest();
    input.snapshot.settings.player!.name = name;
    const job = await admitJob({
      request: encodeRequest(input),
      ownerKey,
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: digest(ownerKey) },
    });
    const admittedSnapshot = (
      await pool.query("SELECT request FROM tg_jobs WHERE id=$1", [job.jobId])
    ).rows[0].request.snapshot;
    await executeTopGear(job.jobId, undefined, evaluator);
    const row = (
      await pool.query(
        "SELECT status,settled,report FROM tg_jobs WHERE id=$1",
        [job.jobId],
      )
    ).rows[0];
    expect(row).toMatchObject({ status: "complete", settled: true });
    // Compare canonical stored data: protobuf JSON omits the default empty name.
    expect(row.report.snapshot).toEqual(admittedSnapshot);
    const frozen = row.report;
    await executeTopGear(job.jobId, undefined, evaluator);
    expect(
      (await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [job.jobId]))
        .rows[0].report,
    ).toEqual(frozen);
    expect(
      (
        await pool.query(
          "SELECT character_name FROM library_items WHERE job_id=$1",
          [job.jobId],
        )
      ).rows,
    ).toEqual([{ character_name: "Unnamed character" }]);
    expect(
      (await pool.query("SELECT reserved FROM tg_budgets")).rows[0].reserved,
    ).toBe("0");
  },
);

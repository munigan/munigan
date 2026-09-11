import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import {
  seedAccount,
  seedTerminalReport,
  publishSeededReport,
} from "../support/accounts";
import {
  deleteLibraryReport,
  requestAccountDeletion,
  cleanupAccounts,
} from "@/server/accounts/deletion";
import { cleanupReports } from "@/server/reports/cleanup";
import { readReport } from "@/server/reports/read";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
beforeEach(async () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  await pool.query(
    "TRUNCATE tg_jobs,auth_user,tg_budgets,auth_verification CASCADE",
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await dropTestDatabase();
  await pool.end();
});
it("revokes saved access immediately and scrubs without removing quota skeletons", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  const item = await publishSeededReport(job, account);
  await deleteLibraryReport(account.id, item!);
  await deleteLibraryReport(account.id, item!);
  await expect(
    readReport(job.token, { account, ownerHash: null }),
  ).rejects.toMatchObject({ status: 404 });
  expect(await cleanupReports()).toEqual({ scrubbed: 1, expired: 0 });
  expect(
    (
      await pool.query(
        "SELECT request,report,token_cipher,settled,account_id FROM tg_jobs WHERE id=$1",
        [job.jobId],
      )
    ).rows[0],
  ).toEqual({
    request: null,
    report: null,
    token_cipher: null,
    settled: true,
    account_id: account.id,
  });
  expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 0 });
});
it("requires a fresh matching account and durably revokes sessions before final cleanup", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  await expect(
    requestAccountDeletion({ account, ownerHash: null }, "other"),
  ).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
  await expect(
    requestAccountDeletion(
      {
        account: { ...account, authenticatedAt: new Date(0).toISOString() },
        ownerHash: null,
      },
      account.id,
    ),
  ).rejects.toMatchObject({ code: "FRESH_LOGIN_REQUIRED" });
  await requestAccountDeletion({ account, ownerHash: null }, account.id);
  await requestAccountDeletion({ account, ownerHash: null }, account.id);
  expect((await pool.query("SELECT * FROM auth_session")).rowCount).toBe(0);
  expect(await cleanupAccounts()).toEqual({ deleted: 0, pending: 1 });
  await cleanupReports();
  expect(await cleanupAccounts()).toEqual({ deleted: 1, pending: 0 });
  expect(
    (
      await pool.query(
        "SELECT account_id,admission_account_id FROM tg_jobs WHERE id=$1",
        [job.jobId],
      )
    ).rows[0],
  ).toEqual({ account_id: null, admission_account_id: null });
  expect((await pool.query("SELECT * FROM auth_user")).rowCount).toBe(0);
  await expect(seedAccount(account.id)).resolves.toMatchObject({
    id: account.id,
  });
});

import { randomUUID } from "node:crypto";
import { admitJob } from "@/server/jobs/admit";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { fixtureRequest } from "../support/fixtures";
import { reconcileJobs } from "@/server/jobs/reconcile";
import { beginSaveIntent, completeSaveIntent } from "@/server/library/claims";
import { digest } from "@/server/jobs/capabilities";
import { vi } from "vitest";
it("settles pending reservations before scrubbing and removes completed intent references only for its account", async () => {
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  try {
    const account = await seedAccount();
    const other = await seedAccount();
    const report = await seedTerminalReport();
    const identity = { account, ownerHash: digest(report.ownerKey) };
    const intent = await beginSaveIntent(report.token, identity);
    await completeSaveIntent(intent.token, identity);
    const otherReport = await seedTerminalReport();
    const otherIdentity = {
      account: other,
      ownerHash: digest(otherReport.ownerKey),
    };
    const otherIntent = await beginSaveIntent(otherReport.token, otherIdentity);
    await completeSaveIntent(otherIntent.token, otherIdentity);
    const job = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    });
    await pool.query(
      "INSERT INTO auth_verification(id,identifier,value,expires_at) VALUES('other-state','opaque-state','other-private-value',now()+interval '10 minutes')",
    );
    await requestAccountDeletion({ account, ownerHash: null }, account.id);
    await cleanupReports();
    expect(await cleanupAccounts()).toEqual({ deleted: 0, pending: 1 });
    expect(
      (await pool.query("SELECT request FROM tg_jobs WHERE id=$1", [job.jobId]))
        .rows[0].request,
    ).not.toBeNull();
    await reconcileJobs();
    expect(
      (await pool.query("SELECT reserved FROM tg_budgets")).rows[0].reserved,
    ).toBe("0");
    expect(
      (await pool.query("SELECT id FROM auth_user WHERE id=$1", [account.id]))
        .rowCount,
    ).toBe(0);
    expect(
      (await pool.query("SELECT completed_by FROM report_save_intents")).rows,
    ).toEqual([{ completed_by: other.id }]);
    expect((await pool.query("SELECT id FROM auth_verification")).rows).toEqual(
      [{ id: "other-state" }],
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/library/[id]/route";
import { POST } from "@/app/api/account/delete/route";
import { getIdentity } from "@/server/auth/identity";
vi.mock("@/server/auth/identity", async (original) => ({
  ...(await original<typeof import("@/server/auth/identity")>()),
  getIdentity: vi.fn(),
}));
it("exposes strict deletion routes with safe errors and expected statuses", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  const item = await publishSeededReport(job, account);
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });
  const req = (body: string, method = "POST", headers = {}) =>
    new NextRequest("http://localhost/api/delete", {
      method,
      body,
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        ...headers,
      },
    });
  expect(
    (
      await DELETE(req("{}", "DELETE"), {
        params: Promise.resolve({ id: item! }),
      })
    ).status,
  ).toBe(204);
  for (const [body, headers, status] of [
    ["{}", {}, 400],
    ['{"expectedUserId":"other"}', {}, 409],
    [" ".repeat(2049), {}, 413],
    ["{}", { origin: "https://evil.test" }, 403],
    ["{}", { "content-type": "application/jsonx" }, 415],
  ] as const) {
    const response = await POST(req(body, "POST", headers));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(
    (await POST(req(JSON.stringify({ expectedUserId: account.id })))).status,
  ).toBe(202);
  vi.mocked(getIdentity).mockRejectedValue(
    new Error("private connection string"),
  );
  const failure = await POST(
    req(JSON.stringify({ expectedUserId: account.id })),
  );
  expect(failure.status).toBe(503);
  expect(JSON.stringify(await failure.json())).not.toContain("private");
});

import { executeTopGear } from "@/server/jobs/work";
it.each(["deletion-first", "publication-first"])(
  "coordinates worker publication and durable deletion: %s",
  async (order) => {
    const account = await seedAccount();
    const admitted = await admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: randomUUID(),
      idempotencyKey: randomUUID(),
      identity: { account, ownerHash: null },
    });
    let entered!: () => void, release!: () => void;
    const enteredPromise = new Promise<void>((r) => {
      entered = r;
    });
    const barrier = new Promise<void>((r) => {
      release = r;
    });
    const worker = executeTopGear(
      admitted.jobId,
      undefined,
      async (_s, loadout, iterations, seed, _signal, isReference) => {
        entered();
        await barrier;
        return {
          loadout,
          inputHash: seed,
          metric: { mean: isReference ? 10000 : 10100, stdev: 10, iterations },
          stats: [],
        };
      },
    );
    await enteredPromise;
    try {
      if (order === "deletion-first") {
        await requestAccountDeletion({ account, ownerHash: null }, account.id);
        expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 0 });
        expect(await cleanupAccounts()).toEqual({ deleted: 0, pending: 1 });
        release();
        await worker;
        expect((await pool.query("SELECT * FROM library_items")).rowCount).toBe(
          0,
        );
      } else {
        release();
        await worker;
        expect((await pool.query("SELECT * FROM library_items")).rowCount).toBe(
          1,
        );
        await requestAccountDeletion({ account, ownerHash: null }, account.id);
      }
      expect(
        (await pool.query("SELECT reserved FROM tg_budgets")).rows[0].reserved,
      ).toBe("0");
      await cleanupReports();
      expect(await cleanupAccounts()).toEqual({ deleted: 1, pending: 0 });
      await expect(
        readReport(admitted.reportToken, { account: null, ownerHash: null }),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      release();
      await worker;
    }
  },
);
it("retries a failed scrub atomically and reports only the failed pass name", async () => {
  const account = await seedAccount();
  const report = await seedTerminalReport({ accountId: account.id });
  await requestAccountDeletion({ account, ownerHash: null }, account.id);
  await pool.query(
    "CREATE FUNCTION fail_scrub() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.scrubbed_at IS NOT NULL THEN RAISE EXCEPTION 'private SQL secret'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER fail_scrub BEFORE UPDATE ON tg_jobs FOR EACH ROW EXECUTE FUNCTION fail_scrub()",
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await reconcileJobs();
    expect(result.failedPasses).toEqual(["reports"]);
    expect(result.oldestDeletionSeconds).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    expect(
      (
        await pool.query("SELECT report,scrubbed_at FROM tg_jobs WHERE id=$1", [
          report.jobId,
        ])
      ).rows[0],
    ).toMatchObject({ scrubbed_at: null });
    expect(
      (
        await pool.query("SELECT * FROM tg_work WHERE job_id=$1", [
          report.jobId,
        ])
      ).rowCount,
    ).toBeGreaterThan(0);
  } finally {
    log.mockRestore();
    await pool.query("DROP TRIGGER fail_scrub ON tg_jobs");
    await pool.query("DROP FUNCTION fail_scrub()");
  }
  await reconcileJobs();
  expect((await pool.query("SELECT * FROM auth_user")).rowCount).toBe(0);
});
it("rejects malformed item IDs as not found and retains tombstone replay rejection after scrubbing", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  const item = await publishSeededReport(job, account);
  await expect(
    deleteLibraryReport(account.id, "-".repeat(36)),
  ).rejects.toMatchObject({ status: 404 });
  const intent = (
    await pool.query("SELECT intent FROM tg_jobs WHERE id=$1", [job.jobId])
  ).rows[0].intent;
  await deleteLibraryReport(account.id, item!);
  await cleanupReports();
  await deleteLibraryReport(account.id, item!);
  await expect(
    admitJob({
      request: encodeRequest(fixtureRequest()),
      ownerKey: job.ownerKey,
      idempotencyKey: intent,
    }),
  ).rejects.toMatchObject({ status: 404 });
});
it("recovers a crashed worker lease before eventual settlement and deletion", async () => {
  const account = await seedAccount();
  const job = await admitJob({
    request: encodeRequest(fixtureRequest()),
    ownerKey: randomUUID(),
    idempotencyKey: randomUUID(),
    identity: { account, ownerHash: null },
  });
  await pool.query(
    "UPDATE tg_jobs SET status='running',lease=$2,lease_until=now()-interval '1 minute' WHERE id=$1",
    [job.jobId, randomUUID()],
  );
  await requestAccountDeletion({ account, ownerHash: null }, account.id);
  const first = await reconcileJobs();
  expect(first.accounts).toEqual({ deleted: 0, pending: 1 });
  expect(
    (
      await pool.query("SELECT status,request FROM tg_jobs WHERE id=$1", [
        job.jobId,
      ])
    ).rows[0],
  ).toMatchObject({ status: "queued" });
  const second = await reconcileJobs();
  expect(second.accounts).toEqual({ deleted: 1, pending: 0 });
  expect(
    (await pool.query("SELECT reserved FROM tg_budgets")).rows[0].reserved,
  ).toBe("0");
  expect(
    (
      await pool.query("SELECT request,settled FROM tg_jobs WHERE id=$1", [
        job.jobId,
      ])
    ).rows[0],
  ).toEqual({ request: null, settled: true });
});

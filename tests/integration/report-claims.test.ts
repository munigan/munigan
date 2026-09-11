import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { pool } from "@/server/db/client";
import { digest } from "@/server/jobs/capabilities";
import {
  beginSaveIntent,
  claimReport,
  completeSaveIntent,
} from "@/server/library/claims";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { seedAccount, seedTerminalReport } from "../support/accounts";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
beforeEach(async () => {
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  await pool.query("TRUNCATE tg_jobs,auth_user,tg_budgets CASCADE");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await dropTestDatabase();
  await pool.end();
});
const anonymous = (ownerKey: string) => ({
  account: null,
  ownerHash: digest(ownerKey),
});
it("completes once, retries safely, stores only a digest and preserves admission identity", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
  expect(intent.token).toMatch(/^[\w-]{43}$/);
  expect(
    (await pool.query("SELECT token_hash FROM report_save_intents")).rows[0]
      .token_hash,
  ).toBe(digest(intent.token));
  const identity = { ...anonymous(job.ownerKey), account };
  const first = await completeSaveIntent(intent.token, identity);
  expect(await completeSaveIntent(intent.token, identity)).toEqual(first);
  expect(await claimReport(job.token, { account, ownerHash: null })).toEqual(
    first,
  );
  expect(first.reportPath).toBe(`/reports/${job.token}`);
  expect(
    (
      await pool.query(
        "SELECT account_id,admission_account_id FROM tg_jobs WHERE id=$1",
        [job.jobId],
      )
    ).rows[0],
  ).toEqual({ account_id: account.id, admission_account_id: null });
  await expect(
    beginSaveIntent(job.token, anonymous("other")),
  ).rejects.toMatchObject({ status: 404 });
});
it("bounds concurrent outstanding intents across an owner's different jobs", async () => {
  const jobs: Awaited<ReturnType<typeof seedTerminalReport>>[] = [];
  for (let i = 0; i < 7; i++) jobs.push(await seedTerminalReport());
  await pool.query("UPDATE tg_jobs SET owner_hash=$1", [
    digest(jobs[0].ownerKey),
  ]);
  const attempts = await Promise.allSettled(
    jobs.map((j) => beginSaveIntent(j.token, anonymous(jobs[0].ownerKey))),
  );
  expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(5);
  expect(
    (await pool.query("SELECT count(*)::int AS n FROM report_save_intents"))
      .rows[0].n,
  ).toBe(5);
});
it("allows only one competing account to claim an intent", async () => {
  const accounts = await Promise.all([seedAccount(), seedAccount()]);
  const job = await seedTerminalReport();
  const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
  const results = await Promise.allSettled(
    accounts.map((account) =>
      completeSaveIntent(intent.token, { ...anonymous(job.ownerKey), account }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CLAIM_CONFLICT", status: 409 },
  });
  expect(
    (await pool.query("SELECT count(*)::int AS n FROM library_items")).rows[0]
      .n,
  ).toBe(1);
});
it("rejects missing authentication, missing intent and changed browser", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
  await expect(
    completeSaveIntent(intent.token, anonymous(job.ownerKey)),
  ).rejects.toMatchObject({ status: 401 });
  for (const ownerHash of [null, digest("other")])
    await expect(
      completeSaveIntent(intent.token, { account, ownerHash }),
    ).rejects.toMatchObject({ code: "OWNER_COOKIE_REQUIRED" });
  await expect(
    completeSaveIntent("x".repeat(43), {
      account,
      ownerHash: digest(job.ownerKey),
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    claimReport(job.token, { account, ownerHash: null }),
  ).rejects.toMatchObject({ status: 404 });
});
it.each(["deleted", "expired", "empty", "intent-expired"])(
  "rejects %s during OAuth without ownership or publication",
  async (state) => {
    const account = await seedAccount();
    const job = await seedTerminalReport();
    const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
    if (state === "deleted")
      await pool.query("UPDATE tg_jobs SET deleted_at=now() WHERE id=$1", [
        job.jobId,
      ]);
    if (state === "expired")
      await pool.query(
        "UPDATE tg_jobs SET expires_at=now()-interval '1 second' WHERE id=$1",
        [job.jobId],
      );
    if (state === "empty")
      await pool.query(
        "UPDATE tg_jobs SET report=jsonb_set(report,'{rows}','[]') WHERE id=$1",
        [job.jobId],
      );
    if (state === "intent-expired")
      await pool.query(
        "UPDATE report_save_intents SET expires_at=now()-interval '1 second'",
      );
    await expect(
      completeSaveIntent(intent.token, { ...anonymous(job.ownerKey), account }),
    ).rejects.toMatchObject({
      code: {
        deleted: "NOT_FOUND",
        expired: "REPORT_EXPIRED",
        empty: "REPORT_NOT_READY",
        "intent-expired": "INTENT_EXPIRED",
      }[state],
    });
    expect(
      (
        await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
          job.jobId,
        ])
      ).rows[0].account_id,
    ).toBeNull();
    expect((await pool.query("SELECT * FROM library_items")).rows).toEqual([]);
  },
);
it("finishes an issued intent after new saving is disabled", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const identity = { ...anonymous(job.ownerKey), account };
  const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
  vi.stubEnv("REPORT_SAVING_ENABLED", "false");
  await expect(
    beginSaveIntent(job.token, anonymous(job.ownerKey)),
  ).rejects.toMatchObject({ code: "SAVING_UNAVAILABLE" });
  await expect(claimReport(job.token, identity)).rejects.toMatchObject({
    code: "SAVING_UNAVAILABLE",
  });
  expect((await completeSaveIntent(intent.token, identity)).reportPath).toBe(
    `/reports/${job.token}`,
  );
});
it("rolls back ownership and intent completion when publication fails", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const intent = await beginSaveIntent(job.token, anonymous(job.ownerKey));
  await pool.query(
    "CREATE FUNCTION fail_claim_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private SQL detail'; END $$",
  );
  await pool.query(
    "CREATE TRIGGER fail_claim BEFORE INSERT ON library_items FOR EACH ROW EXECUTE FUNCTION fail_claim_publication()",
  );
  try {
    await expect(
      completeSaveIntent(intent.token, { ...anonymous(job.ownerKey), account }),
    ).rejects.toThrow();
    expect(
      (
        await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
          job.jobId,
        ])
      ).rows[0].account_id,
    ).toBeNull();
    expect(
      (await pool.query("SELECT completed_at FROM report_save_intents")).rows[0]
        .completed_at,
    ).toBeNull();
    expect((await pool.query("SELECT * FROM library_items")).rows).toEqual([]);
  } finally {
    await pool.query("DROP TRIGGER fail_claim ON library_items");
    await pool.query("DROP FUNCTION fail_claim_publication()");
  }
});

import { NextRequest } from "next/server";
import { POST as beginPOST } from "@/app/api/reports/[token]/save-intent/route";
import { POST as savePOST } from "@/app/api/reports/[token]/save/route";
import { POST as completePOST } from "@/app/api/library/save-intents/complete/route";
import { getIdentity } from "@/server/auth/identity";
vi.mock("@/server/auth/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/identity")>()),
  getIdentity: vi.fn(),
}));
const request = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/save", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
it("validates small strict JSON requests and secures all error responses", async () => {
  for (const handler of [beginPOST, savePOST, completePOST]) {
    for (const [payload, headers, status] of [
      ["[]", {}, 400],
      ['{"unknown":1}', {}, 400],
      ["{}", { origin: "https://evil.example" }, 403],
      ["{}", { "content-type": "text/plain" }, 415],
      ["{}", { "content-type": "application/jsonx" }, 415],
      [" ".repeat(2049), {}, 413],
      ["{", {}, 400],
    ] as const) {
      const response = await handler(request(payload, headers), {
        params: Promise.resolve({ token: "x".repeat(43) }),
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
  }
  const missing = await completePOST(request("{}"));
  expect(missing.status).toBe(400);
});
it("returns route statuses and hides unexpected internal errors", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const params = { params: Promise.resolve({ token: job.token }) };
  vi.mocked(getIdentity).mockResolvedValue(anonymous(job.ownerKey));
  const begun = await beginPOST(request("{}"), params);
  expect(begun.status).toBe(201);
  vi.mocked(getIdentity).mockResolvedValue({
    ...anonymous(job.ownerKey),
    account,
  });
  const completed = await completePOST(
    request(JSON.stringify({ token: (await begun.json()).token })),
  );
  expect(completed.status).toBe(200);
  expect((await savePOST(request("{}"), params)).status).toBe(200);
  vi.mocked(getIdentity).mockRejectedValue(
    new Error("secret database connection string"),
  );
  const failed = await savePOST(request("{}"), params);
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain("secret");
});
it("never recreates a missing publication on a completed intent retry", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport();
  const identity = { ...anonymous(job.ownerKey), account };
  const intent = await beginSaveIntent(job.token, identity);
  await completeSaveIntent(intent.token, identity);
  await pool.query("DELETE FROM library_items WHERE job_id=$1", [job.jobId]);
  await expect(
    completeSaveIntent(intent.token, identity),
  ).rejects.toMatchObject({ status: 404 });
});
it.each(["deleted", "expired"])(
  "rechecks %s after waiting for a concurrent job transaction",
  async (state) => {
    const account = await seedAccount();
    const job = await seedTerminalReport();
    const identity = { ...anonymous(job.ownerKey), account };
    const intent = await beginSaveIntent(job.token, identity);
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM tg_jobs WHERE id=$1 FOR UPDATE", [
      job.jobId,
    ]);
    const result = completeSaveIntent(intent.token, identity).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        await blocker.query("SELECT pg_stat_clear_snapshot()");
        const locks = await blocker.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE 'SELECT j.*,clock_timestamp()%'",
        );
        if (locks.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await blocker.query(
        state === "deleted"
          ? "UPDATE tg_jobs SET deleted_at=clock_timestamp() WHERE id=$1"
          : "UPDATE tg_jobs SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [job.jobId],
      );
      await blocker.query("COMMIT");
      expect(await result).toMatchObject({
        error: { code: state === "deleted" ? "NOT_FOUND" : "REPORT_EXPIRED" },
      });
      expect(
        (
          await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [
            job.jobId,
          ])
        ).rows[0].account_id,
      ).toBeNull();
      expect((await pool.query("SELECT * FROM library_items")).rows).toEqual(
        [],
      );
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await result;
    }
  },
);
it("serializes competing direct and intent claims", async () => {
  const a = await seedAccount();
  const b = await seedAccount();
  const job = await seedTerminalReport();
  const identity = anonymous(job.ownerKey);
  const intent = await beginSaveIntent(job.token, identity);
  const results = await Promise.allSettled([
    claimReport(job.token, { ...identity, account: a }),
    completeSaveIntent(intent.token, { ...identity, account: b }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CLAIM_CONFLICT" },
  });
});

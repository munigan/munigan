import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { AccountError } from "@/server/auth/errors";
import { digest } from "@/server/jobs/capabilities";
import { readReport } from "@/server/reports/read";
import { admitJob } from "@/server/jobs/admit";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { fixtureRequest } from "../support/fixtures";
import { seedAccount, seedTerminalReport } from "../support/accounts";
import { NextRequest } from "next/server";
import { GET as reportGET } from "@/app/api/reports/[token]/route";

process.env.CAPABILITY_KEY = "a".repeat(64);

beforeAll(createTestDatabase);
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});

const identity = (
  account: Awaited<ReturnType<typeof seedAccount>> | null,
  ownerKey?: string,
) => ({
  account,
  ownerHash: ownerKey ? digest(ownerKey) : null,
});

async function retain(jobId: string, accountId: string) {
  await pool.query(
    `INSERT INTO library_items(id,user_id,job_id,tool,kind,title,character_name,summary,created_at)
     SELECT $1,$2,id,'top-gear','report','Report','Adventurer','{}',created_at FROM tg_jobs WHERE id=$3`,
    [randomUUID(), accountId, jobId],
  );
}

it("reads a valid capability publicly and rejects a wrong token", async () => {
  const report = await seedTerminalReport();
  expect((await readReport(report.token)).report.token).toBe(report.token);
  await expect(readReport(randomUUID())).rejects.toMatchObject({
    code: "NOT_FOUND",
    status: 404,
  } satisfies Partial<AccountError>);
});

it("expires anonymous reports using database time", async () => {
  const report = await seedTerminalReport();
  await pool.query(
    "UPDATE tg_jobs SET expires_at=now()-interval '1 second' WHERE id=$1",
    [report.jobId],
  );
  await expect(readReport(report.token)).rejects.toMatchObject({
    code: "REPORT_EXPIRED",
    status: 410,
  } satisfies Partial<AccountError>);
});

it("keeps a retained report readable past its anonymous expiry", async () => {
  const account = await seedAccount();
  const report = await seedTerminalReport({ accountId: account.id });
  await retain(report.jobId, account.id);
  await pool.query(
    "UPDATE tg_jobs SET expires_at=now()-interval '1 day' WHERE id=$1",
    [report.jobId],
  );
  const data = await readReport(report.token);
  expect(data.access).toMatchObject({ saved: true, effectiveExpiresAt: null });
});

it("uses account ownership after claim without falling back to the old owner cookie", async () => {
  const account = await seedAccount();
  const other = await seedAccount();
  const report = await seedTerminalReport({ accountId: account.id });
  expect(
    (await readReport(report.token, identity(account))).access.canManage,
  ).toBe(true);
  expect(
    (await readReport(report.token, identity(other))).access.canManage,
  ).toBe(false);
  expect(
    (await readReport(report.token, identity(null, report.ownerKey))).access
      .canManage,
  ).toBe(false);
});

it("does not read deleted reports", async () => {
  const report = await seedTerminalReport();
  await pool.query("UPDATE tg_jobs SET deleted_at=now() WHERE id=$1", [
    report.jobId,
  ]);
  await expect(readReport(report.token)).rejects.toMatchObject({
    code: "NOT_FOUND",
    status: 404,
  });
});

it("does not read reports owned by an account being deleted", async () => {
  const account = await seedAccount();
  const report = await seedTerminalReport({ accountId: account.id });
  await pool.query(
    "UPDATE account_lifecycle SET status='deleting',deletion_requested_at=now() WHERE user_id=$1",
    [account.id],
  );
  await expect(readReport(report.token)).rejects.toMatchObject({
    code: "NOT_FOUND",
    status: 404,
  });
});

it("does not treat a library row for an empty failed job as retention", async () => {
  const account = await seedAccount();
  const ownerKey = randomUUID();
  const admitted = await admitJob({
    request: encodeRequest(fixtureRequest()),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  await pool.query(
    "UPDATE tg_jobs SET account_id=$2,status='failed',phase='complete',settled=true,expires_at=now()-interval '1 second' WHERE id=$1",
    [admitted.jobId, account.id],
  );
  await retain(admitted.jobId, account.id);
  await expect(
    readReport(admitted.reportToken, identity(account)),
  ).rejects.toMatchObject({
    code: "REPORT_EXPIRED",
    status: 410,
  });
});

it("initializes only absent or invalid owner cookies after a successful report GET", async () => {
  const report = await seedTerminalReport();
  const params = { params: Promise.resolve({ token: report.token }) };
  const initialized = await reportGET(
    new NextRequest(`http://localhost/api/reports/${report.token}`),
    params,
  );
  expect(initialized.status).toBe(200);
  const payload = await initialized.json();
  expect(payload.access).toMatchObject({ saved: false, canManage: false });
  expect(payload.report.access).toBeUndefined();
  expect(JSON.stringify(payload)).not.toContain(digest(report.ownerKey));
  expect(initialized.headers.getSetCookie()[0]).toMatch(
    /^tg_owner=[\w-]{43}; Path=\/; Expires=.*; Max-Age=2592000; HttpOnly; SameSite=strict$/,
  );

  const valid = "v".repeat(43);
  const preserved = await reportGET(
    new NextRequest(`http://localhost/api/reports/${report.token}`, {
      headers: { cookie: `tg_owner=${valid}` },
    }),
    params,
  );
  expect(preserved.status).toBe(200);
  expect(preserved.headers.getSetCookie()).toEqual([]);

  const replaced = await reportGET(
    new NextRequest(`http://localhost/api/reports/${report.token}`, {
      headers: { cookie: "tg_owner=invalid" },
    }),
    params,
  );
  expect(replaced.status).toBe(200);
  expect(replaced.headers.getSetCookie()[0]).toMatch(/^tg_owner=[\w-]{43};/);
});

it("does not convert session resolution failure into owner management", async () => {
  const report = await seedTerminalReport();
  const previous = process.env.REPORT_SAVING_ENABLED;
  process.env.REPORT_SAVING_ENABLED = "true";
  try {
    const response = await reportGET(
      new NextRequest(`http://localhost/api/reports/${report.token}`, {
        headers: { cookie: `tg_owner=${report.ownerKey}` },
      }),
      { params: Promise.resolve({ token: report.token }) },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "AUTH_UNAVAILABLE",
      error: "Authentication is temporarily unavailable",
    });
  } finally {
    if (previous === undefined) delete process.env.REPORT_SAVING_ENABLED;
    else process.env.REPORT_SAVING_ENABLED = previous;
  }
});

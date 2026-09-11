import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { AccountError } from "@/server/auth/errors";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { pool, transaction } from "@/server/db/client";
import {
  libraryReportPath,
  listLibrary,
  publishReport,
} from "@/server/library/repository";
import { readReport } from "@/server/reports/read";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import {
  publishSeededReport,
  seedAccount,
  seedTerminalReport,
} from "../support/accounts";

process.env.CAPABILITY_KEY = "a".repeat(64);

beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE auth_user, tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});

it("isolates owners and publishes a report idempotently", async () => {
  const a = await seedAccount("library-a");
  const b = await seedAccount("library-b");
  const job = await seedTerminalReport({ accountId: a.id });
  const itemId = await publishSeededReport(job, a);
  expect(await publishSeededReport(job, a)).toBe(itemId);
  expect((await listLibrary(a.id, {})).items).toHaveLength(1);
  expect((await listLibrary(b.id, {})).items).toEqual([]);
  await expect(
    libraryReportPath(b.id, (await listLibrary(a.id, {})).items[0].id),
  ).rejects.toMatchObject({ status: 404 });
});

it("escapes search metacharacters and excludes full report fields", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  await publishSeededReport(job, account);
  await pool.query("UPDATE library_items SET title=$2 WHERE job_id=$1", [
    job.jobId,
    "Literal 100%_\\ match",
  ]);

  const item = (await listLibrary(account.id, { search: "%_\\" })).items[0];
  expect(item.title).toBe("Literal 100%_\\ match");
  expect(item).not.toHaveProperty("report");
  expect(item).not.toHaveProperty("request");
  expect(item).not.toHaveProperty("tokenCipher");
  expect((await listLibrary(account.id, { search: "%_x" })).items).toEqual([]);
});

it("paginates equal timestamps by id and validates bounded cursors", async () => {
  const account = await seedAccount();
  const savedAt = new Date("2026-01-01T00:00:00.000Z");
  for (let index = 0; index < 22; index += 1) {
    const job = await seedTerminalReport({ accountId: account.id });
    await publishSeededReport(job, account);
    await pool.query("UPDATE library_items SET saved_at=$2 WHERE job_id=$1", [
      job.jobId,
      savedAt,
    ]);
  }

  const first = await listLibrary(account.id, {});
  const second = await listLibrary(account.id, { cursor: first.nextCursor! });
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(2);
  expect(
    new Set([...first.items, ...second.items].map((item) => item.id)).size,
  ).toBe(22);
  await expect(
    listLibrary(account.id, { cursor: "bad" }),
  ).rejects.toMatchObject({
    code: "INVALID_REQUEST",
    status: 400,
  } satisfies Partial<AccountError>);
  await expect(
    listLibrary(account.id, { cursor: "x".repeat(1025) }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    listLibrary(account.id, { tool: "other" as "top-gear" }),
  ).rejects.toMatchObject({
    status: 400,
  });
});

it("publishes partial and canceled successes but rejects failed empty reports", async () => {
  const account = await seedAccount();
  const partial = await seedTerminalReport({ accountId: account.id });
  await pool.query(
    "UPDATE tg_jobs SET status='partial',report=jsonb_set(report,'{status}','\"partial\"') WHERE id=$1",
    [partial.jobId],
  );
  const canceled = await seedTerminalReport({ accountId: account.id });
  await pool.query(
    "UPDATE tg_jobs SET status='canceled',report=jsonb_set(report,'{status}','\"canceled\"') WHERE id=$1",
    [canceled.jobId],
  );
  expect(await publishSeededReport(partial, account)).toEqual(
    expect.any(String),
  );
  expect(await publishSeededReport(canceled, account)).toEqual(
    expect.any(String),
  );

  const failed = await seedTerminalReport({ accountId: account.id });
  await pool.query(
    "UPDATE tg_jobs SET status='failed',report=jsonb_set(jsonb_set(report,'{status}','\"failed\"'),'{rows}','[]') WHERE id=$1",
    [failed.jobId],
  );
  await expect(publishSeededReport(failed, account)).rejects.toMatchObject({
    status: 409,
  });
});

it("keeps tombstones hidden and never reactivates them", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  const itemId = await publishSeededReport(job, account);
  await pool.query("UPDATE library_items SET deleted_at=now() WHERE id=$1", [
    itemId,
  ]);
  expect((await listLibrary(account.id, {})).items).toEqual([]);
  await expect(libraryReportPath(account.id, itemId!)).rejects.toMatchObject({
    status: 404,
  });
  await expect(publishSeededReport(job, account)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (
      await pool.query("SELECT deleted_at FROM library_items WHERE id=$1", [
        itemId,
      ])
    ).rows[0].deleted_at,
  ).not.toBeNull();
});

it("rejects an existing publication owned by another account", async () => {
  const owner = await seedAccount();
  const other = await seedAccount();
  const job = await seedTerminalReport({ accountId: owner.id });
  await publishSeededReport(job, owner);
  await expect(publishSeededReport(job, other)).rejects.toMatchObject({
    status: 404,
  });
});

it("rejects publication after the locked job is deleted", async () => {
  const account = await seedAccount();
  const job = await seedTerminalReport({ accountId: account.id });
  await publishSeededReport(job, account);
  const { report } = await readReport(job.token, {
    account,
    ownerHash: null,
  });
  await pool.query("UPDATE tg_jobs SET deleted_at=now() WHERE id=$1", [
    job.jobId,
  ]);

  await expect(
    transaction(async (client) => {
      await lockActiveAccount(client, account.id);
      await client.query("SELECT id FROM tg_jobs WHERE id=$1 FOR UPDATE", [
        job.jobId,
      ]);
      return publishReport(client, {
        jobId: job.jobId,
        userId: account.id,
        report,
      });
    }),
  ).rejects.toMatchObject({ status: 404 });
});

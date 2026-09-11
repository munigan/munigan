import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import {
  seedAccount,
  seedTerminalReport,
  publishSeededReport,
} from "../support/accounts";
import { cleanupReports } from "@/server/reports/cleanup";
import { readReport } from "@/server/reports/read";
process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE tg_jobs,auth_user,tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
it("keeps saved reports beyond original expiry while expiring anonymous and empty account runs", async () => {
  const a = await seedAccount();
  const saved = await seedTerminalReport({ accountId: a.id });
  await publishSeededReport(saved, a);
  await seedTerminalReport();
  const empty = await seedTerminalReport({ accountId: a.id });
  await pool.query(
    "UPDATE tg_jobs SET report=NULL,status='failed' WHERE id=$1",
    [empty.jobId],
  );
  await pool.query("UPDATE tg_jobs SET expires_at=now()-interval '31 days'");
  expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 2 });
  await expect(
    readReport(saved.token, { account: null, ownerHash: null }),
  ).resolves.toHaveProperty("report");
});
it("preserves grace period, reservations, retry parents, and explicit tombstones", async () => {
  const parent = await seedTerminalReport();
  const child = await seedTerminalReport();
  const pending = await seedTerminalReport();
  const grace = await seedTerminalReport();
  await pool.query("UPDATE tg_jobs SET expires_at=now()-interval '31 days'");
  await pool.query("UPDATE tg_jobs SET prior_job=$2 WHERE id=$1", [
    child.jobId,
    parent.jobId,
  ]);
  await pool.query("UPDATE tg_jobs SET settled=false WHERE id=$1", [
    pending.jobId,
  ]);
  await pool.query(
    "UPDATE tg_jobs SET expires_at=now()-interval '29 days' WHERE id=$1",
    [grace.jobId],
  );
  expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 1 });
  expect((await pool.query("SELECT id FROM tg_jobs")).rowCount).toBe(3);
});

import { vi } from "vitest";
import { claimReport } from "@/server/library/claims";
import { digest } from "@/server/jobs/capabilities";
import { deleteLibraryReport } from "@/server/accounts/deletion";
async function waitForLock(pattern: string) {
  for (let i = 0; i < 200; i++) {
    if (
      (
        await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
          [pattern],
        )
      ).rowCount
    )
      return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Expected lock wait");
}
it.each(["claim-first", "expiry-first"])(
  "serializes claiming against physical expiry: %s",
  async (order) => {
    vi.stubEnv("REPORT_SAVING_ENABLED", "true");
    const account = await seedAccount();
    const job = await seedTerminalReport();
    const gate = await pool.connect();
    await gate.query("SELECT pg_advisory_lock(827431)");
    let action: Promise<unknown> | undefined;
    let second: Promise<unknown> | undefined;
    try {
      if (order === "claim-first") {
        await pool.query(
          "CREATE FUNCTION hold_retention() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE tg_jobs SET expires_at=now()-interval '31 days' WHERE id=NEW.job_id; PERFORM pg_advisory_xact_lock(827431); RETURN NEW; END $$",
        );
        await pool.query(
          "CREATE TRIGGER hold_retention BEFORE INSERT ON library_items FOR EACH ROW EXECUTE FUNCTION hold_retention()",
        );
        action = claimReport(job.token, {
          account,
          ownerHash: digest(job.ownerKey),
        });
        await waitForLock("INSERT INTO library_items%");
        expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 0 });
        await gate.query("SELECT pg_advisory_unlock(827431)");
        await action;
        expect(await cleanupReports()).toEqual({ scrubbed: 0, expired: 0 });
        await expect(
          readReport(job.token, { account: null, ownerHash: null }),
        ).resolves.toHaveProperty("report");
      } else {
        await pool.query(
          "UPDATE tg_jobs SET expires_at=now()-interval '31 days' WHERE id=$1",
          [job.jobId],
        );
        await pool.query(
          "CREATE FUNCTION hold_retention() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(827431); RETURN OLD; END $$",
        );
        await pool.query(
          "CREATE TRIGGER hold_retention BEFORE DELETE ON tg_jobs FOR EACH ROW EXECUTE FUNCTION hold_retention()",
        );
        action = cleanupReports();
        await waitForLock("DELETE FROM tg_jobs%");
        second = claimReport(job.token, {
          account,
          ownerHash: digest(job.ownerKey),
        }).then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await waitForLock("SELECT j.*,clock_timestamp()%");
        await gate.query("SELECT pg_advisory_unlock(827431)");
        expect(await action).toEqual({ scrubbed: 0, expired: 1 });
        expect(await second).toMatchObject({ error: { status: 404 } });
        expect((await pool.query("SELECT * FROM library_items")).rowCount).toBe(
          0,
        );
      }
    } finally {
      await gate.query("SELECT pg_advisory_unlock(827431)");
      gate.release();
      await action;
      await second;
      await pool.query(
        `DROP TRIGGER IF EXISTS hold_retention ON ${order === "claim-first" ? "library_items" : "tg_jobs"}`,
      );
      await pool.query("DROP FUNCTION IF EXISTS hold_retention()");
      vi.unstubAllEnvs();
    }
  },
);
it("detaches retry children when scrubbing a deleted parent and preserves copied work", async () => {
  const account = await seedAccount();
  const parent = await seedTerminalReport({ accountId: account.id });
  const item = await publishSeededReport(parent, account);
  const child = await seedTerminalReport();
  await pool.query("UPDATE tg_jobs SET prior_job=$2 WHERE id=$1", [
    child.jobId,
    parent.jobId,
  ]);
  const count = (
    await pool.query("SELECT count(*) FROM tg_work WHERE job_id=$1", [
      child.jobId,
    ])
  ).rows[0].count;
  await deleteLibraryReport(account.id, item!);
  expect(await cleanupReports()).toEqual({ scrubbed: 1, expired: 0 });
  expect(
    (
      await pool.query("SELECT prior_job FROM tg_jobs WHERE id=$1", [
        child.jobId,
      ])
    ).rows[0].prior_job,
  ).toBeNull();
  expect(
    (
      await pool.query("SELECT count(*) FROM tg_work WHERE job_id=$1", [
        child.jobId,
      ])
    ).rows[0].count,
  ).toBe(count);
  await expect(
    readReport(child.token, { account: null, ownerHash: null }),
  ).resolves.toHaveProperty("report");
});

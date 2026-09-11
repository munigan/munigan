import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { seedAccount, seedTerminalReport } from "../support/accounts";

process.env.CAPABILITY_KEY = "a".repeat(64);

beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE auth_user, tg_budgets CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});

it("allows only one library entry for a report", async () => {
  const account = await seedAccount();
  const report = await seedTerminalReport({ accountId: account.id });
  const values = [
    account.id,
    report.jobId,
    "A report",
    "Munigan",
    JSON.stringify({
      characterName: "Munigan",
      classKey: "warrior",
      specKey: "fury",
      level: 80,
      dps: 10000,
      gainDps: 500,
    }),
  ];
  const insert =
    "INSERT INTO library_items(id,user_id,job_id,tool,kind,title,character_name,summary,created_at) VALUES($1,$2,$3,'top-gear','report',$4,$5,$6,now())";

  await pool.query(insert, [randomUUID(), ...values]);
  await expect(
    pool.query(insert, [randomUUID(), ...values]),
  ).rejects.toMatchObject({ code: "23505" });
});

it("does not publish a fixture report into the library", async () => {
  const report = await seedTerminalReport();

  expect(
    (
      await pool.query(
        "SELECT count(*)::int count FROM library_items WHERE job_id=$1",
        [report.jobId],
      )
    ).rows[0].count,
  ).toBe(0);
});

it("rejects sessions for deleting accounts at the database boundary", async () => {
  const account = await seedAccount();
  await pool.query(
    "UPDATE account_lifecycle SET status='deleting' WHERE user_id=$1",
    [account.id],
  );

  await expect(
    pool.query(
      "INSERT INTO auth_session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
      [randomUUID(), randomUUID(), account.id],
    ),
  ).rejects.toThrow(/deleting|active/i);
});

it("serializes session creation behind the account lifecycle lock", async () => {
  const account = await seedAccount();
  const deletion = await pool.connect();
  const session = await pool.connect();
  try {
    await deletion.query("BEGIN");
    await deletion.query(
      "SELECT user_id FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
      [account.id],
    );
    await deletion.query(
      "UPDATE account_lifecycle SET status='deleting' WHERE user_id=$1",
      [account.id],
    );
    const pid = (await session.query("SELECT pg_backend_pid() pid")).rows[0]
      .pid;
    const insert = session.query(
      "INSERT INTO auth_session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
      [randomUUID(), randomUUID(), account.id],
    );
    // Observe the blocked backend instead of treating elapsed time as evidence.
    await expect
      .poll(async () => {
        await pool.query("SELECT pg_stat_clear_snapshot()");
        return (
          await pool.query(
            "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
            [pid],
          )
        ).rows[0]?.wait_event_type;
      })
      .toBe("Lock");

    await deletion.query("COMMIT");
    await expect(insert).rejects.toThrow(/active account lifecycle/i);
  } finally {
    await deletion.query("ROLLBACK");
    deletion.release();
    session.release();
  }
});

it("permits payload scrubbing only for deleted settled jobs", async () => {
  const report = await seedTerminalReport();

  await expect(
    pool.query(
      "UPDATE tg_jobs SET request=NULL,policy=NULL,token_cipher=NULL WHERE id=$1",
      [report.jobId],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await pool.query(
    "UPDATE tg_jobs SET request=NULL,policy=NULL,token_cipher=NULL,deleted_at=now(),scrubbed_at=now() WHERE id=$1",
    [report.jobId],
  );
});

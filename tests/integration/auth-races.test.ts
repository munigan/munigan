import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { seedAccount } from "../support/accounts";
import { requestAccountDeletion } from "@/server/accounts/deletion";
beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE auth_user CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
async function waitForLock(pattern: string) {
  for (let i = 0; i < 200; i++) {
    await pool.query("SELECT pg_stat_clear_snapshot()");
    const r = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
      [pattern],
    );
    if (r.rowCount) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Expected database lock wait");
}
it.each(["session-first", "deletion-first"])(
  "serializes session issuance and deletion: %s",
  async (order) => {
    const account = await seedAccount();
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    const insert =
      "INSERT INTO auth_session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$1,$2,now()+interval '1 day',now(),now())";
    let operation: Promise<unknown> | undefined;
    try {
      if (order === "session-first") {
        await blocker.query(insert, [randomUUID(), account.id]);
        operation = requestAccountDeletion(
          { account, ownerHash: null },
          account.id,
        );
        await waitForLock("SELECT status FROM account_lifecycle%FOR UPDATE");
        await blocker.query("COMMIT");
        await operation;
      } else {
        await blocker.query(
          "SELECT user_id FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
          [account.id],
        );
        await blocker.query(
          "UPDATE account_lifecycle SET status='deleting',deletion_requested_at=now() WHERE user_id=$1",
          [account.id],
        );
        await blocker.query("DELETE FROM auth_session WHERE user_id=$1", [
          account.id,
        ]);
        operation = pool.query(insert, [randomUUID(), account.id]).then(
          () => ({ ok: true }),
          (error) => ({ error }),
        );
        await waitForLock("INSERT INTO auth_session%");
        await blocker.query("COMMIT");
        expect(await operation).toHaveProperty("error");
      }
      expect(
        (
          await pool.query("SELECT * FROM auth_session WHERE user_id=$1", [
            account.id,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await operation;
    }
  },
);

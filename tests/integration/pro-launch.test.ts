import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { pool } from "@/server/db/client";
import { PRO_CONSENT_VERSION } from "@/domain/pro-launch/contracts";
import {
  joinProLaunchList,
  readProLaunchStatus,
} from "@/server/pro-launch/repository";
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

it("keeps one first consent across concurrent joins", async () => {
  const account = await seedAccount();
  expect(await readProLaunchStatus(account)).toEqual({ status: "not_joined" });
  const input = {
    expectedUserId: account.id,
    source: "header" as const,
    locale: "en-US" as const,
    consentVersion: PRO_CONSENT_VERSION,
  };
  const results = await Promise.all([
    joinProLaunchList(account, input),
    joinProLaunchList(account, input),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0].status).toBe("joined");
  const persisted = await pool.query(
    "SELECT discord_account_id FROM pro_launch_memberships",
  );
  expect(persisted.rowCount).toBe(1);
  expect(persisted.rows[0].discord_account_id).toBe(`discord-${account.id}`);
  expect(await readProLaunchStatus(account)).toEqual(results[0]);
});

it("does not join a different account than the one shown", async () => {
  const account = await seedAccount();
  await expect(
    joinProLaunchList(account, {
      expectedUserId: "someone-else",
      source: "header",
      locale: "en-US",
      consentVersion: PRO_CONSENT_VERSION,
    }),
  ).rejects.toMatchObject({ code: "ACCOUNT_CHANGED", status: 409 });
});

it("fails closed when the account has no Discord link", async () => {
  const account = await seedAccount();
  await pool.query("DELETE FROM auth_account WHERE user_id=$1", [account.id]);

  await expect(
    joinProLaunchList(account, {
      expectedUserId: account.id,
      source: "header",
      locale: "en-US",
      consentVersion: PRO_CONSENT_VERSION,
    }),
  ).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", status: 503 });
  expect(
    (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

it("never reads another account's membership", async () => {
  const member = await seedAccount();
  const other = await seedAccount();
  await joinProLaunchList(member, {
    expectedUserId: member.id,
    source: "header",
    locale: "en-US",
    consentVersion: PRO_CONSENT_VERSION,
  });

  expect(await readProLaunchStatus(other)).toEqual({ status: "not_joined" });
});

it("preserves the first consent metadata on a repeated join", async () => {
  const account = await seedAccount();
  const first = await joinProLaunchList(account, {
    expectedUserId: account.id,
    source: "header",
    locale: "en-US",
    consentVersion: PRO_CONSENT_VERSION,
  });
  const repeated = await joinProLaunchList(account, {
    expectedUserId: account.id,
    source: "gear_limit",
    locale: "pt-BR",
    consentVersion: PRO_CONSENT_VERSION,
  });

  expect(repeated).toEqual(first);
  expect(
    (
      await pool.query(
        "SELECT source,locale,consent_version,joined_at FROM pro_launch_memberships WHERE user_id=$1",
        [account.id],
      )
    ).rows[0],
  ).toEqual({
    source: "header",
    locale: "en-US",
    consent_version: PRO_CONSENT_VERSION,
    joined_at: new Date(first.joinedAt),
  });
});

it("removes membership as soon as account deletion is requested", async () => {
  const account = await seedAccount();
  await joinProLaunchList(account, {
    expectedUserId: account.id,
    source: "header",
    locale: "en-US",
    consentVersion: PRO_CONSENT_VERSION,
  });

  await requestAccountDeletion({ account, ownerHash: null }, account.id);

  expect(
    (
      await pool.query(
        "SELECT * FROM pro_launch_memberships WHERE user_id=$1",
        [account.id],
      )
    ).rowCount,
  ).toBe(0);
});

async function waitForLifecycleLock(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await pool.query("SELECT pg_stat_clear_snapshot()");
    const waiting = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT status FROM account_lifecycle%FOR UPDATE'",
    );
    if (waiting.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected launch-list join to wait for the lifecycle lock");
}

it("rejects a join after deletion wins the lifecycle lock", async () => {
  const account = await seedAccount();
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  let joining: Promise<unknown> | undefined;
  try {
    await blocker.query(
      "SELECT status FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
      [account.id],
    );
    await blocker.query(
      "UPDATE account_lifecycle SET status='deleting',deletion_requested_at=now() WHERE user_id=$1",
      [account.id],
    );
    joining = joinProLaunchList(account, {
      expectedUserId: account.id,
      source: "header",
      locale: "en-US",
      consentVersion: PRO_CONSENT_VERSION,
    });
    await waitForLifecycleLock();
    await blocker.query("COMMIT");

    await expect(joining).rejects.toMatchObject({
      code: "ACCOUNT_DELETING",
      status: 409,
    });
    expect(
      (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
    ).toBe(0);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await joining?.catch(() => undefined);
  }
});

it("cascades membership when the user is finally removed", async () => {
  const account = await seedAccount();
  await joinProLaunchList(account, {
    expectedUserId: account.id,
    source: "header",
    locale: "en-US",
    consentVersion: PRO_CONSENT_VERSION,
  });

  await pool.query("DELETE FROM auth_user WHERE id=$1", [account.id]);

  expect(
    (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

import type { RequestIdentity } from "@/domain/accounts/contracts";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { AccountError } from "@/server/auth/errors";
import { requireAccount } from "@/server/auth/identity";
import { pool, transaction } from "@/server/db/client";

// userId comes exclusively from the server-resolved session at the HTTP boundary.
export async function deleteLibraryReport(
  userId: string,
  itemId: string,
): Promise<void> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      itemId,
    )
  )
    throw new AccountError("NOT_FOUND", 404);
  await transaction(async (c) => {
    await lockActiveAccount(c, userId);
    const item = (
      await c.query(
        "SELECT job_id FROM library_items WHERE id=$1 AND user_id=$2",
        [itemId, userId],
      )
    ).rows[0];
    if (!item) throw new AccountError("NOT_FOUND", 404);
    const job = await c.query(
      "SELECT id FROM tg_jobs WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [item.job_id, userId],
    );
    if (!job.rowCount) throw new AccountError("NOT_FOUND", 404);
    await c.query(
      "UPDATE tg_jobs SET deleted_at=coalesce(deleted_at,now()) WHERE id=$1",
      [item.job_id],
    );
    await c.query(
      "UPDATE library_items SET deleted_at=coalesce(deleted_at,now()) WHERE id=$1",
      [itemId],
    );
  });
}
export async function requestAccountDeletion(
  identity: RequestIdentity,
  expectedUserId: string,
): Promise<void> {
  const account = requireAccount(identity);
  if (account.id !== expectedUserId)
    throw new AccountError("ACCOUNT_CHANGED", 409);
  const age = Date.now() - Date.parse(account.authenticatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 300_000)
    throw new AccountError("FRESH_LOGIN_REQUIRED", 409);
  await transaction(async (c) => {
    // FOR UPDATE conflicts with the auth_session trigger's FOR KEY SHARE.
    const lifecycle = (
      await c.query(
        "SELECT status FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
        [account.id],
      )
    ).rows[0];
    if (!lifecycle) throw new AccountError("NOT_FOUND", 404);
    if (lifecycle.status === "deleting") return;
    const session = await c.query(
      "SELECT id FROM auth_session WHERE id=$1 AND user_id=$2 AND expires_at>clock_timestamp() AND created_at>=clock_timestamp()-interval '300 seconds'",
      [account.sessionId, account.id],
    );
    if (!session.rowCount) throw new AccountError("FRESH_LOGIN_REQUIRED", 409);
    await c.query(
      "UPDATE account_lifecycle SET status='deleting',deletion_requested_at=now() WHERE user_id=$1",
      [account.id],
    );
    await c.query(
      "UPDATE tg_jobs SET deleted_at=coalesce(deleted_at,now()),cancel_requested=CASE WHEN NOT settled THEN true ELSE cancel_requested END WHERE account_id=$1",
      [account.id],
    );
    await c.query(
      "UPDATE library_items SET deleted_at=coalesce(deleted_at,now()) WHERE user_id=$1",
      [account.id],
    );
    await c.query("DELETE FROM auth_session WHERE user_id=$1", [account.id]);
  });
}
export async function cleanupAccounts(): Promise<{
  deleted: number;
  pending: number;
}> {
  let deleted = 0;
  const candidates = await pool.query(
    "SELECT user_id FROM account_lifecycle WHERE status='deleting' ORDER BY deletion_requested_at LIMIT 100",
  );
  for (const { user_id: userId } of candidates.rows) {
    const removed = await transaction(async (c) => {
      const account = await c.query(
        "SELECT user_id FROM account_lifecycle WHERE user_id=$1 AND status='deleting' FOR UPDATE SKIP LOCKED",
        [userId],
      );
      if (!account.rowCount) return false;
      const pending = await c.query(
        "SELECT 1 FROM tg_jobs WHERE account_id=$1 AND (NOT settled OR scrubbed_at IS NULL OR deleted_at IS NULL) LIMIT 1",
        [userId],
      );
      if (pending.rowCount) return false;
      // Lifecycle blocks claims/publication. Intents precede jobs, matching completion.
      await c.query(
        "DELETE FROM report_save_intents WHERE completed_by=$1 OR job_id IN (SELECT id FROM tg_jobs WHERE account_id=$1)",
        [userId],
      );
      await c.query("DELETE FROM library_items WHERE user_id=$1", [userId]);
      await c.query(
        "UPDATE tg_jobs SET account_id=NULL,admission_account_id=NULL WHERE account_id=$1",
        [userId],
      );
      await c.query("DELETE FROM auth_session WHERE user_id=$1", [userId]);
      await c.query("DELETE FROM auth_account WHERE user_id=$1", [userId]);
      // Discord-only verification rows are opaque OAuth state, with no user FK or
      // ownership identifier. Do not guess ownership from identifier/value substrings.
      await c.query("DELETE FROM auth_user WHERE id=$1", [userId]);
      return true;
    });
    if (removed) deleted++;
  }
  const pending = await pool.query(
    "SELECT count(*)::int AS n FROM account_lifecycle WHERE status='deleting'",
  );
  return { deleted, pending: pending.rows[0].n };
}

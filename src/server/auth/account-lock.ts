import type pg from "pg";
import { pool } from "@/server/db/client";
import { AccountError } from "./errors";

function checkActive(status: string | undefined): void {
  if (!status) throw new AccountError("NOT_FOUND", 404);
  if (status !== "active") throw new AccountError("ACCOUNT_DELETING", 409);
}
export async function assertActiveAccount(userId: string): Promise<void> {
  const result = await pool.query(
    "SELECT status FROM account_lifecycle WHERE user_id=$1",
    [userId],
  );
  checkActive(result.rows[0]?.status);
}
// The caller owns the transaction and must acquire this before any job lock.
export async function lockActiveAccount(
  client: pg.PoolClient,
  userId: string,
): Promise<void> {
  const result = await client.query(
    "SELECT status FROM account_lifecycle WHERE user_id=$1 FOR UPDATE",
    [userId],
  );
  checkActive(result.rows[0]?.status);
}

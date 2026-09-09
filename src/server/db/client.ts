import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { randomBytes } from "node:crypto";
export const testSchema = process.env.VITEST
  ? `tg_test_${randomBytes(8).toString("hex")}`
  : null;
const globalDb = globalThis as unknown as { topGearPool?: pg.Pool };
export const pool =
  globalDb.topGearPool ??
  new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://127.0.0.1:55435/wow_top_gear",
    max: 4,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
    options: testSchema ? `-c search_path=${testSchema}` : undefined,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
if (process.env.VERCEL) attachDatabasePool(pool);
if (process.env.NODE_ENV !== "production") globalDb.topGearPool = pool;
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

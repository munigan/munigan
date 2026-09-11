import pg from "pg";
import { migrate } from "../src/server/db/migrate";
import { migrationDatabaseUrl } from "../src/server/db/migration-url";
const pool = new pg.Pool({
  connectionString: migrationDatabaseUrl({
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    DATABASE_URL: process.env.DATABASE_URL,
  }),
  max: 1,
});
try {
  const client = await pool.connect();
  try {
    await migrate(client);
    console.log("Top Gear schema ready");
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

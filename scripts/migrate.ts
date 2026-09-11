import { pool } from "../src/server/db/client";
import { migrate } from "../src/server/db/migrate";
const client = await pool.connect();
try {
  await migrate(client);
  console.log("Top Gear schema ready");
} finally {
  client.release();
  await pool.end();
}

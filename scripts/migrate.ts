import { readFile } from "node:fs/promises";
import { pool } from "../src/server/db/client";
try {
  await pool.query(await readFile("drizzle/0000_top_gear.sql", "utf8"));
  console.log("Top Gear schema ready");
} finally {
  await pool.end();
}

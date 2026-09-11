import { betterAuth } from "better-auth";
import pg from "pg";
import { authOptions } from "./options";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://127.0.0.1:55435/wow_top_gear",
});

export const auth = betterAuth({
  ...authOptions(process.env),
  database: pool,
});

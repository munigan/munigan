import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";

const migrationLock = 33050339;
const baselineName = "0000_top_gear.sql";
const baselineTables = ["tg_budgets", "tg_jobs", "tg_outbox", "tg_work"];
const baselineColumns: Record<string, string[]> = {
  tg_budgets: ["day", "reserved", "spent"],
  tg_jobs: [
    "id",
    "owner_hash",
    "intent",
    "request_hash",
    "token_hash",
    "token_cipher",
    "request",
    "policy",
    "status",
    "phase",
    "plan",
    "report",
    "termination",
    "error",
    "created_at",
    "expires_at",
    "budget_day",
    "reserved",
    "cancel_requested",
    "lease",
    "lease_until",
    "settled",
    "prior_job",
    "source_hash",
    "deadline_at",
  ],
  tg_work: ["job_id", "work_key", "attempts", "result", "error"],
  tg_outbox: [
    "job_id",
    "dispatched_at",
    "attempts",
    "next_attempt_at",
    "generation",
  ],
};
const baselineConstraints: Record<string, string> = {
  tg_budgets_pkey: "PRIMARY KEY (day)",
  tg_jobs_pkey: "PRIMARY KEY (id)",
  tg_jobs_token_hash_key: "UNIQUE (token_hash)",
  tg_jobs_owner_hash_intent_key: "UNIQUE (owner_hash, intent)",
  tg_jobs_budget_day_fkey:
    "FOREIGN KEY (budget_day) REFERENCES tg_budgets(day)",
  tg_jobs_prior_job_fkey: "FOREIGN KEY (prior_job) REFERENCES tg_jobs(id)",
  tg_work_pkey: "PRIMARY KEY (job_id, work_key)",
  tg_work_job_id_fkey:
    "FOREIGN KEY (job_id) REFERENCES tg_jobs(id) ON DELETE CASCADE",
  tg_outbox_pkey: "PRIMARY KEY (job_id)",
  tg_outbox_job_id_fkey:
    "FOREIGN KEY (job_id) REFERENCES tg_jobs(id) ON DELETE CASCADE",
};

function checksum(contents: Buffer) {
  return createHash("sha256").update(contents).digest("hex");
}

async function tableNames(client: pg.PoolClient) {
  const result = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=ANY($1::text[])",
    [baselineTables],
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function verifyBaseline(client: pg.PoolClient) {
  const columns = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=ANY($1::text[])",
    [baselineTables],
  );
  const presentColumns = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  for (const [table, names] of Object.entries(baselineColumns)) {
    for (const name of names) {
      if (!presentColumns.has(`${table}.${name}`)) {
        throw new Error(`Baseline is incompatible: missing ${table}.${name}`);
      }
    }
  }

  const constraints = await client.query<{
    conname: string;
    definition: string;
  }>(
    `SELECT c.conname,pg_catalog.pg_get_constraintdef(c.oid) AS definition
       FROM pg_catalog.pg_constraint c
       JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
       JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=current_schema() AND t.relname=ANY($1::text[])`,
    [baselineTables],
  );
  const presentConstraints = new Map(
    constraints.rows.map((row) => [row.conname, row.definition]),
  );
  for (const [name, definition] of Object.entries(baselineConstraints)) {
    const actual = presentConstraints.get(name);
    if (actual !== definition) {
      throw new Error(
        `Baseline is incompatible: constraint ${name} expected ${definition}, found ${actual ?? "missing"}`,
      );
    }
  }
}

async function applyMigration(
  client: pg.PoolClient,
  name: string,
  contents: Buffer,
) {
  await client.query("BEGIN");
  try {
    if (name === baselineName) {
      const existing = await tableNames(client);
      if (existing.size > 0 && existing.size < baselineTables.length) {
        const missing = baselineTables.find((table) => !existing.has(table));
        throw new Error(`Partial baseline: missing ${missing}`);
      }
    }
    await client.query(contents.toString("utf8"));
    if (name === baselineName) await verifyBaseline(client);
    await client.query(
      "INSERT INTO app_migrations(name,checksum) VALUES($1,$2)",
      [name, checksum(contents)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function migrate(
  client: pg.PoolClient,
  directory = "drizzle",
): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1)", [migrationLock]);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const names = (await readdir(resolve(directory)))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const name of names) {
      const contents = await readFile(resolve(directory, name));
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM app_migrations WHERE name=$1",
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum(contents)) {
          throw new Error(`Checksum mismatch for migration ${name}`);
        }
        continue;
      }
      await applyMigration(client, name, contents);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [migrationLock]);
  }
}

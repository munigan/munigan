import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, it } from "vitest";
import { pool, testSchema } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { createTestDatabase, dropTestDatabase } from "../support/database";

const baselinePath = "drizzle/0000_top_gear.sql";

async function migrationDirectory(...migrations: Array<[string, string]>) {
  const directory = await mkdtemp(join(tmpdir(), "tg-migrations-"));
  for (const [name, sql] of migrations) {
    await writeFile(join(directory, name), sql);
  }
  return directory;
}

beforeEach(async () => {
  await dropTestDatabase();
});

afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});

it("creates a fresh schema and records the baseline", async () => {
  await createTestDatabase();

  expect(
    (await pool.query("SELECT name FROM app_migrations ORDER BY name")).rows,
  ).toEqual([{ name: "0000_top_gear.sql" }]);
  expect(
    (
      await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name LIKE 'tg_%' ORDER BY table_name",
        [testSchema],
      )
    ).rows,
  ).toEqual([
    { table_name: "tg_budgets" },
    { table_name: "tg_jobs" },
    { table_name: "tg_outbox" },
    { table_name: "tg_work" },
  ]);
});

it("adopts the baseline and can run twice without changing jobs", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  const c = await pool.connect();
  try {
    await c.query(await readFile(baselinePath, "utf8"));
    await c.query(
      "INSERT INTO tg_budgets(day,reserved,spent) VALUES('2026-09-10',0,123)",
    );
    await migrate(c);
    await migrate(c);
    expect(
      (await c.query("SELECT spent FROM tg_budgets WHERE day='2026-09-10'"))
        .rows[0].spent,
    ).toBe("123");
    expect(
      (
        await c.query(
          "SELECT count(*) FROM app_migrations WHERE name='0000_top_gear.sql'",
        )
      ).rows[0].count,
    ).toBe("1");
  } finally {
    c.release();
  }
});

it("serializes concurrent migration runners", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  const baseline = await readFile(baselinePath, "utf8");
  const directory = await migrationDirectory(
    ["0000_top_gear.sql", baseline],
    [
      "0001_once.sql",
      "CREATE TABLE migration_once (id integer PRIMARY KEY); INSERT INTO migration_once VALUES (1);",
    ],
  );
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await Promise.all([migrate(a, directory), migrate(b, directory)]);
    expect(
      (await pool.query("SELECT count(*) FROM migration_once")).rows[0].count,
    ).toBe("1");
    expect(
      (await pool.query("SELECT count(*) FROM app_migrations")).rows[0].count,
    ).toBe("2");
  } finally {
    a.release();
    b.release();
    await rm(directory, { recursive: true });
  }
});

it("rolls back a failed migration and does not record it", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  const baseline = await readFile(baselinePath, "utf8");
  const directory = await migrationDirectory(
    ["0000_top_gear.sql", baseline],
    [
      "0001_broken.sql",
      "CREATE TABLE should_roll_back (id integer); SELECT missing_column FROM should_roll_back;",
    ],
  );
  const c = await pool.connect();
  try {
    await expect(migrate(c, directory)).rejects.toThrow(/missing_column/);
    expect(
      (await c.query("SELECT to_regclass('should_roll_back') AS table")).rows[0]
        .table,
    ).toBeNull();
    expect(
      (await c.query("SELECT name FROM app_migrations ORDER BY name")).rows,
    ).toEqual([{ name: "0000_top_gear.sql" }]);
  } finally {
    c.release();
    await rm(directory, { recursive: true });
  }
});

it("rejects an edited migration after it has been applied", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  const baseline = await readFile(baselinePath, "utf8");
  const directory = await migrationDirectory(["0000_top_gear.sql", baseline]);
  const c = await pool.connect();
  try {
    await migrate(c, directory);
    await writeFile(
      join(directory, "0000_top_gear.sql"),
      `${baseline}\n-- edited`,
    );
    await expect(migrate(c, directory)).rejects.toThrow(
      /checksum mismatch.*0000_top_gear\.sql/i,
    );
  } finally {
    c.release();
    await rm(directory, { recursive: true });
  }
});

it("rejects a partial baseline instead of repairing it", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query("CREATE TABLE tg_budgets (day date PRIMARY KEY)");
  const c = await pool.connect();
  try {
    await expect(migrate(c)).rejects.toThrow(/tg_jobs/);
    expect(
      (await c.query("SELECT to_regclass('tg_jobs') AS table")).rows[0].table,
    ).toBeNull();
    expect(
      (await c.query("SELECT to_regclass('app_migrations') AS table")).rows[0]
        .table,
    ).toBe("app_migrations");
    expect(
      (await c.query("SELECT count(*) FROM app_migrations")).rows[0].count,
    ).toBe("0");
  } finally {
    c.release();
  }
});

it("rejects an incompatible complete baseline without losing data", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query(await readFile(baselinePath, "utf8"));
  await pool.query(
    "ALTER TABLE tg_jobs DROP CONSTRAINT tg_jobs_token_hash_key",
  );
  await pool.query(
    "INSERT INTO tg_budgets(day,reserved,spent) VALUES('2026-09-10',0,321)",
  );
  const c = await pool.connect();
  try {
    await expect(migrate(c)).rejects.toThrow(/tg_jobs_token_hash_key/);
    expect(
      (await c.query("SELECT spent FROM tg_budgets WHERE day='2026-09-10'"))
        .rows[0].spent,
    ).toBe("321");
    expect(
      (await c.query("SELECT count(*) FROM app_migrations")).rows[0].count,
    ).toBe("0");
  } finally {
    c.release();
  }
});

it("rejects a constraint whose expected name has the wrong definition", async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query(await readFile(baselinePath, "utf8"));
  await pool.query(
    "ALTER TABLE tg_jobs DROP CONSTRAINT tg_jobs_token_hash_key",
  );
  await pool.query(
    "ALTER TABLE tg_jobs ADD CONSTRAINT tg_jobs_token_hash_key UNIQUE (token_cipher)",
  );
  const c = await pool.connect();
  try {
    await expect(migrate(c)).rejects.toThrow(/tg_jobs_token_hash_key/);
    expect(
      (await c.query("SELECT count(*) FROM app_migrations")).rows[0].count,
    ).toBe("0");
  } finally {
    c.release();
  }
});

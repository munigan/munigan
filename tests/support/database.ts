import { pool, testSchema } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";

function schemaName(): string {
  if (!testSchema || !/^tg_test_[a-f0-9]{16}$/.test(testSchema)) {
    throw new Error(
      "Refusing database test operation without a valid tg_test_ schema",
    );
  }
  return testSchema;
}

export async function createTestDatabase(): Promise<void> {
  const schema = schemaName();
  await pool.query(`CREATE SCHEMA ${schema}`);
  const client = await pool.connect();
  try {
    await migrate(client);
  } finally {
    client.release();
  }
}

export async function dropTestDatabase(): Promise<void> {
  const schema = schemaName();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
}

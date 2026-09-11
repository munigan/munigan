import { randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "../../src/server/db/migrate";
const schema = `tg_oauth_e2e_${randomBytes(8).toString("hex")}`;
const url = new URL(
  process.env.DATABASE_URL ?? "postgresql://127.0.0.1:55435/wow_top_gear",
);
const admin = new pg.Pool({
  connectionString: url.toString(),
  max: 1,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
let child: ReturnType<typeof spawn> | undefined;
let stopping = false;
let worker: ReturnType<typeof spawn> | undefined;
const directory = ".superpowers/sdd/2026-09-10-discord-authentication";
mkdirSync(directory, { recursive: true });
const marker = `${directory}/oauth-runtime.json`;
const events = `${directory}/oauth-events.jsonl`;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const process of [child, worker]) {
    if (!process || process.exitCode !== null || process.signalCode !== null)
      continue;
    const exited = new Promise<void>((resolve) =>
      process.once("exit", () => resolve()),
    );
    process.kill("SIGTERM");
    const timeout = setTimeout(() => process.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timeout);
  }
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  rmSync(marker, { force: true });
  rmSync(events, { force: true });
}
process.once("SIGTERM", () => {
  void stop();
});
process.once("SIGINT", () => {
  void stop();
});
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const client = await admin.connect();
  try {
    await client.query(`SET search_path TO ${schema}`);
    await migrate(client);
  } finally {
    client.release();
  }
  url.searchParams.set("options", `-c search_path=${schema}`);
  writeFileSync(
    marker,
    JSON.stringify({ schema, databaseURL: url.toString(), events }),
  );
  writeFileSync(events, "");
  const env = {
    ...process.env,
    NODE_ENV: "development" as const,
    APP_ENV: "local",
    TOP_GEAR_ITERATIONS: "500",
    TRIGGER_SECRET_KEY: "",
    APP_ORIGIN: "http://127.0.0.1:3100",
    BETTER_AUTH_URL: "http://127.0.0.1:3100",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DISCORD_CLIENT_ID: "oauth-e2e-client",
    DISCORD_CLIENT_SECRET: "oauth-e2e-client-secret",
    AUTH_ENROLLMENT_ENABLED:
      process.env.OAUTH_E2E_ROLLBACK === "1" ? "false" : "true",
    REPORT_SAVING_ENABLED:
      process.env.OAUTH_E2E_ROLLBACK === "1" ? "false" : "true",
    CAPABILITY_KEY: "a".repeat(64),
    DATABASE_URL: url.toString(),
    OAUTH_E2E_HARNESS: "1",
    OAUTH_E2E_EVENTS_FILE: events,
    NODE_OPTIONS: `--import=${fileURLToPath(new URL("./discord-fetch-preload.mjs", import.meta.url))}`,
  };
  delete (env as Record<string, unknown>).VITEST;
  if (process.env.OAUTH_E2E_ANONYMOUS === "1") {
    env.BETTER_AUTH_SECRET = "";
    env.DISCORD_CLIENT_ID = "";
    env.DISCORD_CLIENT_SECRET = "";
    env.AUTH_ENROLLMENT_ENABLED = "false";
    env.REPORT_SAVING_ENABLED = "false";
    env.NODE_OPTIONS = "";
    worker = spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
      env,
      stdio: "ignore",
    });
  }
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { env, stdio: ["ignore", "ignore", "ignore"] },
  );
  child.once("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      void stop();
    }
  });
} catch {
  await stop();
  throw new Error("OAuth harness startup failed");
}

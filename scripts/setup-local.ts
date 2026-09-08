import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";
const candidates = [
  process.env.PG_BIN,
  "/opt/homebrew/opt/postgresql@16/bin",
  "/usr/lib/postgresql/16/bin",
];
try {
  candidates.push(
    execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim(),
  );
} catch {}
const pg = candidates.find((p) => p && existsSync(join(p, "initdb")));
if (!pg)
  throw new Error("Install PostgreSQL 16 or set PG_BIN to its bin directory.");
const directory = resolve(".cache/pgdata"),
  log = resolve(".cache/pg.log");
mkdirSync(".cache", { recursive: true });
const run = (name: string, args: string[]) =>
  execFileSync(join(pg, name), args, { stdio: "inherit" });
if (!existsSync(join(directory, "PG_VERSION")))
  run("initdb", [
    "-D",
    directory,
    "-A",
    "trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
try {
  execFileSync(join(pg, "pg_ctl"), ["-D", directory, "status"], {
    stdio: "ignore",
  });
} catch {
  run("pg_ctl", [
    "-D",
    directory,
    "-l",
    log,
    "-o",
    "-h 127.0.0.1 -p 55435 -k /tmp",
    "start",
  ]);
}
const existing = execFileSync(
  join(pg, "psql"),
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55435",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname='wow_top_gear'",
  ],
  { encoding: "utf8" },
).trim();
if (!existing)
  run("createdb", ["-h", "127.0.0.1", "-p", "55435", "wow_top_gear"]);
if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    `APP_ENV=local\nAPP_ORIGIN=http://127.0.0.1:3000\nDATABASE_URL=postgresql://${encodeURIComponent(userInfo().username)}@127.0.0.1:55435/wow_top_gear\nCAPABILITY_KEY=${randomBytes(32).toString("hex")}\nTOP_GEAR_ITERATIONS=500\n`,
    { mode: 0o600 },
  );
} else chmodSync(".env.local", 0o600);
if (!existsSync("dist/simulator/local/wowsimcli"))
  execFileSync("pnpm", ["sim:build"], { stdio: "inherit" });
execFileSync("pnpm", ["db:migrate"], { stdio: "inherit" });
console.log(
  "Local setup complete. Run pnpm dev and pnpm worker in separate terminals.",
);

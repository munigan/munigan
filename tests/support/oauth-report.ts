import { readFileSync } from "node:fs";
/** Bind the fixture singleton before importing any server helper. */
async function seedOAuthReport(ownerKey: string) {
  const runtime = JSON.parse(
    readFileSync(
      ".superpowers/sdd/2026-09-10-discord-authentication/oauth-runtime.json",
      "utf8",
    ),
  );
  if (!/^tg_oauth_e2e_[a-f0-9]{16}$/.test(runtime.schema))
    throw new Error("Invalid fixture schema");
  delete process.env.VITEST;
  process.env.DATABASE_URL = runtime.databaseURL;
  process.env.CAPABILITY_KEY = "a".repeat(64);
  const { pool } = await import("../../src/server/db/client");
  const { seedTerminalReport } = await import("./accounts");
  const { digest } = await import("../../src/server/jobs/capabilities");
  const job = await seedTerminalReport();
  const stored = (
    await pool.query("SELECT report FROM tg_jobs WHERE id=$1", [job.jobId])
  ).rows[0].report;
  const base = stored.rows[0];
  const head = stored.snapshot.inventory.find(
    (i: { instanceId: string }) => i.instanceId === base.loadout.head,
  );
  stored.rows = Array.from({ length: 25 }, (_, index) => {
    const instanceId = `harness-head-${index}`;
    stored.snapshot.inventory.push({ ...head, instanceId, enchantId: index });
    return {
      ...base,
      id: `harness-row-${index}`,
      inputHash: `harness-${index}`,
      loadout: { ...base.loadout, head: instanceId },
      dps: 11000 - index,
      gain: 1000 - index,
      percent: 10 - index / 100,
      isEquipped: false,
      tiedToHighest: index === 0,
    };
  });
  stored.rows.push({
    ...base,
    id: "harness-equipped",
    isEquipped: true,
    dps: 10000,
  });
  stored.highestId = stored.rows[0].id;
  stored.equippedId = "harness-equipped";
  stored.coverage = {
    ...stored.coverage,
    planned: 26,
    succeeded: 26,
    returned: 26,
  };
  await pool.query("UPDATE tg_jobs SET report=$2,owner_hash=$3 WHERE id=$1", [
    job.jobId,
    stored,
    digest(ownerKey),
  ]);
  return { ...job, ownerKey };
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(
  JSON.stringify(await seedOAuthReport(JSON.parse(input).ownerKey)),
);

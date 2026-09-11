import { randomUUID } from "node:crypto";
import type { AccountIdentity } from "@/domain/accounts/contracts";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { admitJob } from "@/server/jobs/admit";
import { executeTopGear } from "@/server/jobs/work";
import { pool } from "@/server/db/client";
import { fixtureRequest } from "./fixtures";

export async function seedAccount(id = randomUUID()): Promise<AccountIdentity> {
  const sessionId = randomUUID();
  const authenticatedAt = new Date();
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified,image,created_at,updated_at) VALUES($1,$2,$3,false,NULL,$4,$4)",
    [
      id,
      "Test Adventurer",
      `${id}@discord.placeholder.invalid`,
      authenticatedAt,
    ],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,created_at,updated_at) VALUES($1,$2,'discord',$3,$4,$4)",
    [randomUUID(), `discord-${id}`, id, authenticatedAt],
  );
  await pool.query(
    "INSERT INTO auth_session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)",
    [
      sessionId,
      randomUUID(),
      id,
      new Date(authenticatedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      authenticatedAt,
    ],
  );
  return {
    id,
    name: "Test Adventurer",
    image: null,
    sessionId,
    authenticatedAt: authenticatedAt.toISOString(),
  };
}

export async function seedTerminalReport(
  options: {
    accountId?: string;
    expiresAt?: Date;
  } = {},
): Promise<{ jobId: string; token: string; ownerKey: string }> {
  const ownerKey = randomUUID();
  const admitted = await admitJob({
    request: encodeRequest(fixtureRequest()),
    ownerKey,
    idempotencyKey: randomUUID(),
  });
  await executeTopGear(
    admitted.jobId,
    new AbortController().signal,
    async (_snapshot, loadout, iterations, seed, _signal, isReference) => ({
      loadout,
      inputHash: seed,
      metric: { mean: isReference ? 10000 : 10100, stdev: 10, iterations },
      stats: [],
    }),
  );
  await pool.query(
    "UPDATE tg_jobs SET account_id=$2,expires_at=coalesce($3,expires_at) WHERE id=$1",
    [admitted.jobId, options.accountId ?? null, options.expiresAt ?? null],
  );
  return { jobId: admitted.jobId, token: admitted.reportToken, ownerKey };
}

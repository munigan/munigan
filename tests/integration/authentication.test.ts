import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { pool } from "@/server/db/client";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { seedAccount } from "../support/accounts";
import { getIdentity } from "@/server/auth/identity";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { GET as session } from "@/app/api/account/session/route";
import { GET, POST } from "@/app/api/auth/[...all]/route";

const secret = "local-test-secret-with-at-least-32-characters";
Object.assign(process.env, {
  BETTER_AUTH_SECRET: secret,
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_ORIGIN: "http://localhost:3000",
  DISCORD_CLIENT_ID: "test",
  DISCORD_CLIENT_SECRET: "test",
  AUTH_ENROLLMENT_ENABLED: "true",
  REPORT_SAVING_ENABLED: "true",
});
beforeAll(createTestDatabase);
beforeEach(async () => {
  await pool.query("TRUNCATE auth_user,auth_rate_limit CASCADE");
});
afterAll(async () => {
  await dropTestDatabase();
  await pool.end();
});
function request(token?: string) {
  const cookie = token
    ? `better-auth.session_token=${encodeURIComponent(token + "." + createHmac("sha256", secret).update(token).digest("base64"))}`
    : "";
  return new NextRequest("http://localhost:3000/api/account/session", {
    headers: { cookie },
  });
}
async function seeded() {
  const account = await seedAccount();
  const { rows } = await pool.query(
    "SELECT token FROM auth_session WHERE id=$1",
    [account.sessionId],
  );
  return { account, req: request(rows[0].token) };
}
it("reads safe account fields and rejects revoked and missing sessions", async () => {
  const { account, req } = await seeded();
  expect((await getIdentity(req)).account).toEqual(account);
  await pool.query("DELETE FROM auth_session WHERE id=$1", [account.sessionId]);
  expect((await getIdentity(req)).account).toBeNull();
  expect((await getIdentity(request(randomUUID()))).account).toBeNull();
  expect((await getIdentity(request())).account).toBeNull();
});
it("rejects expired sessions and deleting accounts", async () => {
  const { account, req } = await seeded();
  await pool.query(
    "UPDATE account_lifecycle SET status='deleting' WHERE user_id=$1",
    [account.id],
  );
  await expect(getIdentity(req)).rejects.toMatchObject({
    code: "ACCOUNT_DELETING",
    status: 409,
  });
  await pool.query(
    "UPDATE auth_session SET expires_at=now()-interval '1 second' WHERE id=$1",
    [account.sessionId],
  );
  expect((await getIdentity(req)).account).toBeNull();
});
it("returns sanitized 503 on authoritative session storage failure", async () => {
  const { req } = await seeded();
  await pool.query(
    "ALTER TABLE auth_session RENAME TO auth_session_unavailable",
  );
  try {
    await expect(getIdentity(req)).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
      status: 503,
    });
    const response = await session(req);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "AUTH_UNAVAILABLE",
      error: "Authentication is temporarily unavailable",
    });
  } finally {
    await pool.query(
      "ALTER TABLE auth_session_unavailable RENAME TO auth_session",
    );
  }
});
it("refreshes database expiry and forwards browser renewal only on the session endpoint", async () => {
  const { account, req } = await seeded();
  await pool.query(
    "UPDATE auth_session SET created_at=now()-interval '2 days',updated_at=now()-interval '2 days',expires_at=now()+interval '5 days' WHERE id=$1",
    [account.sessionId],
  );
  const old = (
    await pool.query("SELECT * FROM auth_session WHERE id=$1", [
      account.sessionId,
    ])
  ).rows[0];
  const identity = await getIdentity(req);
  expect(identity.account?.authenticatedAt).toBe(old.created_at.toISOString());
  expect(
    (
      await pool.query("SELECT expires_at FROM auth_session WHERE id=$1", [
        account.sessionId,
      ])
    ).rows[0].expires_at,
  ).toEqual(old.expires_at);
  const response = await session(req);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    account: { id: account.id, name: account.name, image: null },
    savingEnabled: true,
    enrollmentEnabled: true,
  });
  const cookies = response.headers.getSetCookie();
  expect(
    cookies.some(
      (c) =>
        c.includes("better-auth.session_token=") &&
        c.includes("Max-Age=604800"),
    ),
  ).toBe(true);
  expect(
    (
      await pool.query("SELECT expires_at FROM auth_session WHERE id=$1", [
        account.sessionId,
      ])
    ).rows[0].expires_at.getTime(),
  ).toBeGreaterThan(old.expires_at.getTime() + 86400000);
});
it("blocks all unsupported endpoints including concrete token paths through the real handler", async () => {
  for (const path of [
    "delete-user",
    "change-email",
    "update-user",
    "link-social",
    "unlink-account",
    "get-access-token",
    "refresh-token",
    "account-info",
    "list-accounts",
    "sign-up/email",
    "sign-in/email",
    "send-verification-email",
    "verify-email",
    "request-password-reset",
    "reset-password",
    "reset-password/arbitrary-token",
    "verify-password",
    "change-password",
    "set-password",
    "delete-user/callback",
    "callback/google",
  ]) {
    for (const method of ["GET", "POST"]) {
      const req = new Request(`http://localhost:3000/api/auth/${path}`, {
        method,
      });
      expect(
        (await (method === "GET" ? GET(req) : POST(req))).status,
        path,
      ).toBe(404);
    }
  }
  expect(
    (await GET(new Request("http://localhost:3000/api/auth/get-session")))
      .status,
  ).toBe(200);
});
it("serializes session insertion against the lifecycle deletion lock", async () => {
  const { account } = await seeded();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await lockActiveAccount(client, account.id);
    let settled = false;
    const insertion = pool
      .query(
        "INSERT INTO auth_session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
        [randomUUID(), randomUUID(), account.id],
      )
      .then(
        () => ({ ok: true }),
        () => ({ ok: false }),
      )
      .finally(() => {
        settled = true;
      });
    await vi.waitFor(async () => {
      await client.query("SELECT pg_stat_clear_snapshot()");
      const rows = await client.query(
        "SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'INSERT INTO auth_session%' AND pid<>pg_backend_pid()",
      );
      expect(rows.rowCount).toBeGreaterThan(0);
    });
    expect(settled).toBe(false);
    await client.query(
      "UPDATE account_lifecycle SET status='deleting' WHERE user_id=$1",
      [account.id],
    );
    await client.query("DELETE FROM auth_session WHERE user_id=$1", [
      account.id,
    ]);
    await client.query("COMMIT");
    expect(await insertion).toEqual({ ok: false });
    expect(
      (
        await pool.query("SELECT * FROM auth_session WHERE user_id=$1", [
          account.id,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

async function discordSignIn(discordId: string, failProvider = false) {
  await pool.query("TRUNCATE auth_rate_limit");
  const mock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("discord.com/api/oauth2/token"))
        return Response.json({
          access_token: "provider-access-secret",
          refresh_token: "provider-refresh-secret",
          token_type: "Bearer",
          expires_in: 604800,
          scope: "identify",
        });
      if (failProvider && url.includes("/users/"))
        throw new Error("sensitive-provider-token");
      if (decodeURIComponent(url).includes("discord.com/api/users/@me"))
        return Response.json({
          id: discordId,
          username: "Phone User",
          global_name: "Phone User",
          avatar: null,
          discriminator: "0",
          verified: true,
        });
      throw new Error("Unexpected provider request");
    });
  try {
    const start = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "discord",
          callbackURL: "http://localhost:3000/top-gear",
        }),
      }),
    );
    expect(start.status).toBe(200);
    const redirect = new URL((await start.json()).url);
    expect(redirect.searchParams.get("scope")).toBe("identify");
    const cookie = start.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return await GET(
      new Request(
        `http://localhost:3000/api/auth/callback/discord?code=mock-code&state=${redirect.searchParams.get("state")}`,
        { headers: { cookie } },
      ),
    );
  } finally {
    mock.mockRestore();
  }
}
it("creates a phone-only Discord account with synthetic unverified email and encrypted tokens", async () => {
  const response = await discordSignIn("123456789");
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/top-gear",
  );
  const user = (await pool.query("SELECT * FROM auth_user")).rows[0];
  expect(user).toMatchObject({
    email: "123456789@discord.placeholder.invalid",
    email_verified: false,
    name: "Phone User",
  });
  const provider = (await pool.query("SELECT * FROM auth_account")).rows[0];
  expect(provider.provider_id).toBe("discord");
  expect(provider.access_token).not.toBe("provider-access-secret");
  expect(provider.refresh_token).not.toBe("provider-refresh-secret");
  expect(response.headers.getSetCookie().join(" ")).not.toContain(
    "provider-access-secret",
  );
});
it("preserves existing sign-in but blocks new enrollment and deleting-account sessions", async () => {
  await discordSignIn("123456789");
  process.env.AUTH_ENROLLMENT_ENABLED = "false";
  try {
    const existing = await discordSignIn("123456789");
    expect(existing.headers.get("location")).toBe(
      "http://localhost:3000/top-gear",
    );
    await discordSignIn("987654321");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM auth_user")).rows[0].n,
    ).toBe(1);
    await pool.query("UPDATE account_lifecycle SET status='deleting'");
    await pool.query("DELETE FROM auth_session");
    await discordSignIn("123456789");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM auth_session")).rows[0]
        .n,
    ).toBe(0);
  } finally {
    process.env.AUTH_ENROLLMENT_ENABLED = "true";
  }
});

it("sanitizes unexpected provider failures without logging raw secrets", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await discordSignIn("123456789", true);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "AUTH_UNAVAILABLE",
      error: "Authentication is temporarily unavailable",
    });
    expect(logged.mock.calls.flat().map(String).join(" ")).not.toContain(
      "sensitive-provider-token",
    );
  } finally {
    logged.mockRestore();
  }
});
it("rejects client attempts to expand Discord permissions or use token sign-in", async () => {
  for (const body of [
    { provider: "discord", scopes: ["guilds"] },
    { provider: "discord", additionalParams: { scope: "bot" } },
    { provider: "discord", idToken: { token: "secret" } },
    { provider: "google" },
  ]) {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(400);
  }
});
it("validates configured sessions during rollback with both flags off", async () => {
  const { req, account } = await seeded();
  process.env.AUTH_ENROLLMENT_ENABLED = "false";
  process.env.REPORT_SAVING_ENABLED = "false";
  try {
    expect((await getIdentity(req)).account?.id).toBe(account.id);
    const response = await session(req);
    expect(await response.json()).toEqual({
      account: { id: account.id, name: account.name, image: null },
      savingEnabled: false,
      enrollmentEnabled: false,
    });
  } finally {
    process.env.AUTH_ENROLLMENT_ENABLED = "true";
    process.env.REPORT_SAVING_ENABLED = "true";
  }
});
it("rejects untrusted auth origins and return URLs", async () => {
  for (const [origin, callbackURL] of [
    ["https://attacker.invalid", "http://localhost:3000/top-gear"],
    ["http://localhost:3000", "https://attacker.invalid"],
  ]) {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ provider: "discord", callbackURL }),
      }),
    );
    expect(response.status).toBe(403);
  }
});
it("issues host-only HttpOnly OAuth-compatible cookies", async () => {
  const response = await discordSignIn("123456789");
  const cookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("better-auth.session_token="))!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Path=/");
  expect(cookie).not.toMatch(/domain=/i);
});
it("returns unavailable when the provider callback cannot persist a new account", async () => {
  await pool.query(
    "CREATE FUNCTION reject_test_auth_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic sensitive storage details'; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_test_auth_user BEFORE INSERT ON auth_user FOR EACH ROW EXECUTE FUNCTION reject_test_auth_user()",
  );
  try {
    const response = await discordSignIn("123456789");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "AUTH_UNAVAILABLE",
      error: "Authentication is temporarily unavailable",
    });
  } finally {
    await pool.query("DROP TRIGGER reject_test_auth_user ON auth_user");
    await pool.query("DROP FUNCTION reject_test_auth_user()");
  }
});

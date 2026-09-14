import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getIdentity } from "@/server/auth/identity";
import { pool } from "@/server/db/client";
import { GET, POST } from "@/app/api/pro-launch/route";
import { createTestDatabase, dropTestDatabase } from "../support/database";
import { seedAccount } from "../support/accounts";

vi.mock("@/server/auth/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/identity")>()),
  getIdentity: vi.fn(),
}));

const validInput = (expectedUserId: string) => ({
  expectedUserId,
  source: "header",
  locale: "en-US",
  consentVersion: "pro-discord-launch-v1",
});

function postRequest(
  body: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/pro-launch", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

function expectPrivate(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

beforeAll(createTestDatabase);
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  await pool.query("TRUNCATE tg_jobs,auth_user,tg_budgets CASCADE");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await dropTestDatabase();
  await pool.end();
});

it("requires an account for status and join requests", async () => {
  vi.mocked(getIdentity).mockResolvedValue({ account: null, ownerHash: null });

  for (const response of [
    await GET(new NextRequest("http://localhost/api/pro-launch")),
    await POST(postRequest(JSON.stringify(validInput("account-a")))),
  ]) {
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "SIGN_IN_REQUIRED" });
    expectPrivate(response);
  }
});

it("reads status without inserting membership", async () => {
  const account = await seedAccount();
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });

  const response = await GET(
    new NextRequest("http://localhost/api/pro-launch"),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "not_joined" });
  expectPrivate(response);
  expect(
    (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

it("joins idempotently without writing jobs or budgets", async () => {
  const account = await seedAccount();
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });
  const input = validInput(account.id);

  const first = await POST(postRequest(JSON.stringify(input)));
  expect(first.status).toBe(200);
  const firstBody = await first.json();
  expect(firstBody).toMatchObject({
    status: "joined",
    offerVersion: "pro-launch-v1",
  });
  expect(firstBody.joinedAt).toEqual(expect.any(String));
  expectPrivate(first);

  const repeated = await POST(postRequest(JSON.stringify(input)));
  expect(repeated.status).toBe(200);
  expect(await repeated.json()).toEqual(firstBody);
  expectPrivate(repeated);

  const status = await GET(new NextRequest("http://localhost/api/pro-launch"));
  expect(await status.json()).toEqual(firstBody);
  expectPrivate(status);
  expect(
    (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(1);
  expect((await pool.query("SELECT * FROM tg_jobs")).rowCount).toBe(0);
  expect((await pool.query("SELECT * FROM tg_budgets")).rowCount).toBe(0);
});

it.each([
  ["bad origin", {}, { origin: "https://evil.example" }, 403],
  ["non-JSON content", {}, { "content-type": "text/plain" }, 415],
  ["oversized body", " ".repeat(2049), {}, 413],
  [
    "invalid fields",
    { ...validInput("account-a"), discordId: "attacker" },
    {},
    400,
  ],
] as const)("rejects %s", async (_name, payload, headers, expectedStatus) => {
  const account = await seedAccount();
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);

  const response = await POST(postRequest(body, headers));

  expect(response.status).toBe(expectedStatus);
  expectPrivate(response);
  expect(
    (await pool.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

it("rejects an account changed since the join prompt was shown", async () => {
  const account = await seedAccount();
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });

  const response = await POST(
    postRequest(JSON.stringify(validInput("different-account"))),
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "ACCOUNT_CHANGED" });
  expectPrivate(response);
});

it("hides authentication failures", async () => {
  vi.mocked(getIdentity).mockRejectedValue(
    new Error("secret database connection string"),
  );

  for (const response of [
    await GET(new NextRequest("http://localhost/api/pro-launch")),
    await POST(postRequest(JSON.stringify(validInput("account-a")))),
  ]) {
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expectPrivate(response);
  }
});

it("hides persistence failures after successful authentication", async () => {
  const account = await seedAccount();
  vi.mocked(getIdentity).mockResolvedValue({ account, ownerHash: null });
  await pool.query(
    "ALTER TABLE pro_launch_memberships RENAME TO pro_launch_memberships_unavailable",
  );

  try {
    const response = await GET(
      new NextRequest("http://localhost/api/pro-launch"),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "pro_launch_memberships",
    );
    expectPrivate(response);
  } finally {
    await pool.query(
      "ALTER TABLE pro_launch_memberships_unavailable RENAME TO pro_launch_memberships",
    );
  }
});

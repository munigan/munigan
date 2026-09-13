import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getIdentity, requireAccount } from "./identity";
import { getAuth } from "./config";

afterEach(() => vi.unstubAllEnvs());
function disabled() {
  for (const key of [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
  ])
    vi.stubEnv(key, "");
  vi.stubEnv("AUTH_ENROLLMENT_ENABLED", "false");
  vi.stubEnv("REPORT_SAVING_ENABLED", "false");
}
it("supports anonymous identity with auth completely unconfigured", async () => {
  disabled();
  expect(await getIdentity(new NextRequest("http://localhost/test"))).toEqual({
    account: null,
    ownerHash: null,
  });
});
it("never downgrades an auth cookie when auth is unconfigured", async () => {
  disabled();
  for (const cookie of [
    "better-auth.session_token=opaque",
    "__Secure-better-auth.session_token=opaque",
  ]) {
    await expect(
      getIdentity(
        new NextRequest("http://localhost/test", { headers: { cookie } }),
      ),
    ).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", status: 503 });
  }
});
it("rejects missing authentication at a protected account boundary", () => {
  expect(() => requireAccount({ account: null, ownerHash: null })).toThrowError(
    expect.objectContaining({ code: "SIGN_IN_REQUIRED", status: 401 }),
  );
});
it("validates the fixed auth origin before initialization", () => {
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "local-test-secret-with-at-least-32-characters",
  );
  vi.stubEnv("BETTER_AUTH_URL", "https://wrong.example");
  vi.stubEnv("APP_ORIGIN", "https://app.example");
  vi.stubEnv("DISCORD_CLIENT_ID", "test");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test");
  expect(() => getAuth()).toThrowError(
    expect.objectContaining({ code: "AUTH_UNAVAILABLE" }),
  );
});
it("returns disabled session mode without initializing auth and refuses stale auth cookies", async () => {
  disabled();
  const { GET } = await import("@/app/api/account/session/route");
  const response = await GET(
    new Request("http://localhost/api/account/session"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    account: null,
    savingEnabled: false,
    enrollmentEnabled: false,
  });
  expect(
    (
      await GET(
        new Request("http://localhost/api/account/session", {
          headers: { cookie: "better-auth.session_token=stale" },
        }),
      )
    ).status,
  ).toBe(503);
});
it("starts the anonymous worker module without Discord configuration", async () => {
  disabled();
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const result = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "await import('./src/server/jobs/work.ts'); console.log('worker module ready')",
    ],
    { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: "test" } },
  );
  expect(result.stdout.trim()).toBe("worker module ready");
});
it("derives only a valid anonymous owner cookie using the existing digest", async () => {
  disabled();
  const { digest } = await import("@/server/jobs/capabilities");
  const owner = "a".repeat(43);
  expect(
    (
      await getIdentity(
        new NextRequest("http://localhost/test", {
          headers: { cookie: `tg_owner=${owner}` },
        }),
      )
    ).ownerHash,
  ).toBe(digest(owner));
  expect(
    (
      await getIdentity(
        new NextRequest("http://localhost/test", {
          headers: { cookie: "tg_owner=invalid" },
        }),
      )
    ).ownerHash,
  ).toBeNull();
});

it("expires stale auth cookies only in explicitly unlimited local anonymous mode", async () => {
  disabled();
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_UNLIMITED_ADMISSION", "1");
  const { GET } = await import("@/app/api/account/session/route");
  const request = new Request("http://localhost/api/account/session", {
    headers: { cookie: "better-auth.session_token=stale" },
  });
  const response = await GET(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    account: null,
    savingEnabled: false,
  });
  expect(response.headers.get("set-cookie")).toContain(
    "better-auth.session_token=; Max-Age=0",
  );
  vi.stubEnv("NODE_ENV", "production");
  expect((await GET(request)).status).toBe(503);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("REPORT_SAVING_ENABLED", "true");
  expect((await GET(request)).status).toBe(503);
});

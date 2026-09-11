import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as armory from "./armory";

const lookup = { name: "Munigaan", realm: "Onyxia" };
const character = {
  name: "Munigaan",
  class: "Death Knight",
  race: "Orc",
  level: 80,
  gear: {
    items: Array.from({ length: 17 }, (_, index) => ({
      id: index === 0 ? 51227 : 0,
      enchant: 0,
      gems: [],
    })),
  },
  professions: [],
};
const payload = () => ({
  character,
  meta: {
    retrievedAt: new Date().toISOString(),
    source: "live",
    requestId: "worker-request-123",
  },
});

beforeEach(() => {
  vi.stubEnv("WARMANE_RELAY_URL", "https://owned-relay.workers.dev");
  vi.stubEnv("WARMANE_RELAY_SECRET", "test-server-secret");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("retrieves a character and freshness metadata from the private relay", async () => {
  const response = payload();
  vi.stubGlobal("fetch", async (url: URL, options: RequestInit) => {
    expect(String(url)).toBe(
      "https://owned-relay.workers.dev/import?name=Munigaan&realm=Onyxia&mode=refresh",
    );
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-server-secret",
      Accept: "application/json",
    });
    expect(options).toMatchObject({ redirect: "error", cache: "no-store" });
    return Response.json(response);
  });
  expect(await armory.lookupWarmaneCharacter(lookup, "refresh")).toEqual(
    response,
  );
});

it("keeps the original character-only function compatible while routing via the relay", async () => {
  vi.stubGlobal("fetch", async () => Response.json(payload()));
  expect(await armory.importWarmaneCharacter(lookup)).toEqual(character);
});

it("preserves a rate-limit cooldown and saved-profile offer without accepting stale gear", async () => {
  const saved = { retrievedAt: new Date(Date.now() - 120_000).toISOString() };
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        code: "warmaneRateLimited",
        message: "untrusted backend details",
        requestId: "worker-request-123",
        params: { seconds: 45 },
        retryAfterSeconds: 45,
        saved,
      },
      { status: 429 },
    ),
  );
  await expect(armory.lookupWarmaneCharacter(lookup)).rejects.toMatchObject({
    code: "warmaneRateLimited",
    status: 429,
    failure: { retryAfterSeconds: 45, saved, requestId: "worker-request-123" },
  });
});

it.each([
  [
    "wrong character",
    () => ({ ...payload(), character: { ...character, name: "Someoneelse" } }),
  ],
  [
    "incomplete gear",
    () => ({ ...payload(), character: { ...character, gear: { items: [] } } }),
  ],
  [
    "invalid metadata",
    () => ({
      ...payload(),
      meta: { retrievedAt: "yesterday", source: "live", requestId: "req" },
    }),
  ],
  [
    "silent stale result",
    () => ({ ...payload(), meta: { ...payload().meta, source: "saved" } }),
  ],
  [
    "expired saved result",
    () => ({
      ...payload(),
      meta: {
        ...payload().meta,
        retrievedAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
      },
    }),
  ],
])("rejects %s returned by the relay", async (_, response) => {
  vi.stubGlobal("fetch", async () => Response.json(response()));
  await expect(armory.lookupWarmaneCharacter(lookup)).rejects.toMatchObject({
    code: "warmaneRelayUnavailable",
    status: 503,
  });
});

it("accepts a retained saved profile only when explicitly requested", async () => {
  const response = {
    ...payload(),
    meta: {
      ...payload().meta,
      source: "saved",
      retrievedAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  };
  vi.stubGlobal("fetch", async () => Response.json(response));
  expect(await armory.lookupWarmaneCharacter(lookup, "saved")).toEqual(
    response,
  );
});

it.each(["missing-url", "missing-secret", "unsafe-url"])(
  "fails closed for production %s",
  async (reason) => {
    vi.stubEnv("NODE_ENV", "production");
    if (reason === "missing-url") vi.stubEnv("WARMANE_RELAY_URL", "");
    if (reason === "missing-secret") vi.stubEnv("WARMANE_RELAY_SECRET", "");
    if (reason === "unsafe-url")
      vi.stubEnv("WARMANE_RELAY_URL", "http://owned-relay.workers.dev");
    vi.stubGlobal("fetch", async () => {
      throw new Error("must not contact any endpoint");
    });
    await expect(armory.lookupWarmaneCharacter(lookup)).rejects.toMatchObject({
      code: "warmaneRelayUnavailable",
    });
  },
);

it("does not leak upstream messages or credentials on an unexpected response", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("SECRET: test-server-secret", { status: 500 }),
  );
  await expect(armory.lookupWarmaneCharacter(lookup)).rejects.toThrow(
    "temporarily unavailable",
  );
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "test-server-secret",
  );
});

it("rejects invalid lookup and mode before network access", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("must not contact any endpoint");
  });
  await expect(
    armory.lookupWarmaneCharacter({ ...lookup, name: "../secret" }),
  ).rejects.toMatchObject({ code: "warmaneName" });
  await expect(
    armory.lookupWarmaneCharacter(lookup, "unexpected" as "auto"),
  ).rejects.toMatchObject({ code: "invalidInput" });
});

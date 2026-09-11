import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("WARMANE_RELAY_URL", "https://owned-relay.workers.dev");
  vi.stubEnv("WARMANE_RELAY_SECRET", "test-server-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const request = (extra = "") =>
  new NextRequest(
    `https://munigan.app/api/import/warmane?name=Munigaan&realm=Onyxia${extra}`,
  );

it("returns metadata and a private response for an explicit saved-profile request", async () => {
  const character = {
    name: "Munigaan",
    class: "Death Knight",
    race: "Orc",
    level: 80,
    gear: {
      items: Array.from({ length: 17 }, (_, i) => ({
        id: i === 0 ? 51227 : 0,
        enchant: 0,
        gems: [],
      })),
    },
    professions: [],
  };
  const meta = {
    retrievedAt: new Date(Date.now() - 120_000).toISOString(),
    source: "saved",
    requestId: "worker-request-123",
  };
  vi.stubGlobal("fetch", async (url: URL) => {
    expect(url.searchParams.get("mode")).toBe("saved");
    return Response.json({ character, meta });
  });
  const response = await GET(request("&mode=saved"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-request-id")).toBe(meta.requestId);
  expect(await response.json()).toEqual({ character, meta });
});

it("returns retry timing and saved metadata with the failure, without returning gear", async () => {
  const saved = { retrievedAt: new Date(Date.now() - 120_000).toISOString() };
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        code: "warmaneRateLimited",
        message: "upstream details",
        requestId: "worker-request-123",
        retryAfterSeconds: 30,
        saved,
      },
      { status: 429 },
    ),
  );
  const response = await GET(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("30");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toMatchObject({
    code: "warmaneRateLimited",
    params: { seconds: 30 },
    retryAfterSeconds: 30,
    saved,
  });
  expect(body).not.toHaveProperty("character");
  expect(JSON.stringify(body)).not.toContain("upstream details");
});

it.each([
  ["&mode=unexpected", "invalidInput"],
  ["&realm=Unknown", "warmaneRealm"],
])(
  "returns an identified failure for invalid input %s",
  async (extra, code) => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("must not fetch");
    });
    const input = request(extra);
    if (extra.includes("realm"))
      input.nextUrl.searchParams.set("realm", "Unknown");
    const response = await GET(input);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({
      code,
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(body.message).toBe(body.error);
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(response.headers.get("cache-control")).toBe("no-store");
  },
);

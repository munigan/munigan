import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchItemTooltip } from "./relay";
import { GET } from "@/app/api/tooltips/[version]/[id]/route";
const payload = {
  item: {
    schemaVersion: 1,
    id: 50730,
    version: "classic",
    source: {
      provider: "wowhead",
      url: "https://www.wowhead.com/wotlk/item=50730",
    },
    name: "Glorenzelg",
    quality: 4,
    icon: "inv_sword_153",
    itemLevel: 284,
    heroic: true,
    lines: [{ kind: "stat", text: "+198 Strength" }],
    sockets: ["red", "red", "red"],
    socketBonus: "+8 Strength",
  },
  meta: { fetchedAt: new Date().toISOString(), cache: "fresh" },
};
const mock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("ITEM_TOOLTIP_RELAY_URL", "https://tooltip.example/");
  vi.stubEnv("ITEM_TOOLTIP_RELAY_SECRET", "private-secret");
  vi.stubGlobal("fetch", mock);
  mock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const route = (version = "classic", id = "50730") =>
  GET(new Request(`https://munigan.app/api/tooltips/${version}/${id}`), {
    params: Promise.resolve({ version, id }),
  });
it("requests the private fixed endpoint and validates JSON", async () => {
  mock.mockResolvedValueOnce(Response.json(payload));
  expect(await fetchItemTooltip("classic", 50730)).toEqual(payload);
  expect(mock).toHaveBeenCalledWith(
    new URL("https://tooltip.example/v1/items/classic/50730"),
    expect.objectContaining({
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer private-secret",
      },
    }),
  );
});
it("rejects a mismatched version or ID and strips unknown properties", async () => {
  mock.mockResolvedValueOnce(
    Response.json({ ...payload, item: { ...payload.item, id: 40111 } }),
  );
  await expect(fetchItemTooltip("classic", 50730)).rejects.toThrow();
  mock.mockResolvedValueOnce(
    Response.json({ ...payload, html: "<script>bad()</script>" }),
  );
  expect(await fetchItemTooltip("classic", 50730)).not.toHaveProperty("html");
});
it("rejects missing/unsafe configuration before network", async () => {
  for (const value of [
    "",
    "http://tooltip.example/",
    "https://user:pass@tooltip.example/",
    "https://tooltip.example/other?x=1",
  ]) {
    vi.stubEnv("ITEM_TOOLTIP_RELAY_URL", value);
    await expect(fetchItemTooltip("classic", 50730)).rejects.toThrow();
  }
  expect(mock).not.toHaveBeenCalled();
});
it("public API rejects invalid or unknown catalog IDs before the Worker", async () => {
  for (const [version, id] of [
    ["retail", "50730"],
    ["classic", "0"],
    ["classic", "050730"],
    ["classic", "999999"],
    ["classic", "1.5"],
  ])
    expect((await route(version, id)).status).toBeGreaterThanOrEqual(400);
  expect(mock).not.toHaveBeenCalled();
});
it("only caches successful public item data without leaking credentials", async () => {
  mock.mockResolvedValueOnce(Response.json(payload));
  const response = await route();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("public");
  expect(response.headers.get("cache-control")).toContain(
    "stale-while-revalidate",
  );
  expect(await response.text()).not.toContain("private-secret");
  mock.mockResolvedValueOnce(
    new Response("provider internals", { status: 503 }),
  );
  const failure = await route();
  expect(failure.status).toBe(503);
  expect(failure.headers.get("cache-control")).toBe("no-store");
  expect(await failure.text()).not.toContain("provider internals");
});
it("rejects oversized JSON and future metadata", async () => {
  mock.mockResolvedValueOnce(new Response("x".repeat(600000)));
  await expect(fetchItemTooltip("classic", 50730)).rejects.toThrow();
  mock.mockResolvedValueOnce(
    Response.json({
      ...payload,
      meta: {
        ...payload.meta,
        fetchedAt: new Date(Date.now() + 86400_000).toISOString(),
      },
    }),
  );
  await expect(fetchItemTooltip("classic", 50730)).rejects.toThrow();
});

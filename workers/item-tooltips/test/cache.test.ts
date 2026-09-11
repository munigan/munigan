import { env, exports } from "cloudflare:workers";
import { reset, runInDurableObject, evictDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ItemTooltipResponseSchema } from "../../../src/domain/tooltips/contracts";
import wh from "./fixtures/tooltip-wowhead-50730.json";
import cot from "./fixtures/tooltip-cot-50730.html?raw";

const stub = (version = "classic") =>
  env.ITEMS.getByName(`v1-p2:${version}:50730`);
const request = (version = "classic", id = "50730") =>
  exports.default.fetch(`https://relay.test/v1/items/${version}/${id}`, {
    headers: { Authorization: "Bearer test-only-secret" },
  });
const fetchMock = vi.fn<typeof fetch>();
beforeEach(async () => {
  await reset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const upstream = () =>
  fetchMock.mockImplementationOnce(async () => Response.json(wh));
async function age() {
  await runInDurableObject(stub(), (_, state) => {
    state.storage.sql.exec(
      "UPDATE snapshot SET fetched_at = fetched_at - ?",
      8 * 86400_000,
    );
  });
}
it("rejects unauthorized, invalid paths and unsupported methods without fetching", async () => {
  for (const auth of ["", "Bearer wrong"])
    expect(
      (
        await exports.default.fetch(
          "https://relay.test/v1/items/classic/50730",
          { headers: { Authorization: auth } },
        )
      ).status,
    ).toBe(401);
  expect((await request("retail")).status).toBe(400);
  expect((await request("classic", "0")).status).toBe(400);
  expect((await request("classic", "1000001")).status).toBe(400);
  expect((await request("classic", "050730")).status).toBe(400);
  expect(
    (
      await exports.default.fetch("https://relay.test/v1/items/classic/50730", {
        method: "POST",
        headers: { Authorization: "Bearer test-only-secret" },
      })
    ).status,
  ).toBe(405);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("persists fresh results across eviction and never mixes item versions", async () => {
  upstream();
  fetchMock.mockImplementationOnce(async () => new Response(cot));
  const first = ItemTooltipResponseSchema.parse(await (await request()).json());
  await evictDurableObject(stub());
  expect(await (await request()).json()).toEqual(first);
  const original = ItemTooltipResponseSchema.parse(
    await (await request("original")).json(),
  );
  expect(original.item.source.provider).toBe("cavernoftime");
  expect(first.item.source.provider).toBe("wowhead");
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
    "https://nether.wowhead.com/wotlk/tooltip/item/50730",
    "https://wotlk.cavernoftime.com/item=50730",
  ]);
});
it("coalesces concurrent cold requests", async () => {
  fetchMock.mockImplementationOnce(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Response.json(wh);
  });
  const results = await Promise.all(Array.from({ length: 6 }, () => request()));
  expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("serves stale data before a refresh finishes, then replaces it", async () => {
  upstream();
  await request();
  await age();
  let completed = false;
  fetchMock.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    completed = true;
    return Response.json({
      ...wh,
      tooltip: wh.tooltip.replace("+198 Strength", "+199 Strength"),
    });
  });
  const response = await request();
  const stale = ItemTooltipResponseSchema.parse(await response.json());
  expect(completed).toBe(false);
  expect(stale.meta.cache).toBe("stale");
  expect(stale.item.lines).toContainEqual({
    kind: "stat",
    text: "+198 Strength",
  });
  await vi.waitFor(async () => {
    const result = ItemTooltipResponseSchema.parse(
      await (await request()).json(),
    );
    expect(result.meta.cache).toBe("fresh");
    expect(result.item.lines).toContainEqual({
      kind: "stat",
      text: "+199 Strength",
    });
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("failed refresh retains the last good item and cooldown after eviction", async () => {
  upstream();
  await request();
  await age();
  fetchMock.mockImplementationOnce(
    async () => new Response("private challenge", { status: 403 }),
  );
  expect(
    ItemTooltipResponseSchema.parse(await (await request()).json()).meta.cache,
  ).toBe("stale");
  await vi.waitFor(async () => {
    await runInDurableObject(stub(), (_, state) =>
      expect(
        state.storage.sql
          .exec<{ retry_until: number }>("SELECT retry_until FROM control")
          .one().retry_until,
      ).toBeGreaterThan(Date.now()),
    );
  });
  await evictDurableObject(stub());
  const result = await request();
  expect(result.status).toBe(200);
  expect(await result.text()).not.toContain("private challenge");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("cold failures persist bounded Retry-After and never leak provider content", async () => {
  fetchMock.mockImplementationOnce(
    async () =>
      new Response("private rate-limit body", {
        status: 429,
        headers: { "retry-after": "900" },
      }),
  );
  const first = await request();
  expect(first.status).toBe(503);
  expect(first.headers.get("retry-after")).toBe("900");
  expect(await first.text()).not.toContain("private");
  await evictDurableObject(stub());
  expect((await request()).status).toBe(503);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("a truncated refresh never replaces a complete snapshot", async () => {
  upstream();
  await request();
  await age();
  fetchMock.mockImplementationOnce(async () =>
    Response.json({ ...wh, tooltip: wh.tooltip.split("<!--ue-->")[0] }),
  );
  const stale = ItemTooltipResponseSchema.parse(await (await request()).json());
  await vi.waitFor(async () => {
    await runInDurableObject(stub(), (_, state) =>
      expect(
        state.storage.sql.exec("SELECT * FROM control").toArray(),
      ).toHaveLength(1),
    );
  });
  await evictDurableObject(stub());
  expect(await (await request()).json()).toEqual(stale);
  expect(stale.item.sockets).toEqual(["red", "red", "red"]);
  expect(
    stale.item.lines.filter((line) => line.kind === "effect"),
  ).toHaveLength(2);
});
it.each([
  { body: "missing", status: 404, expected: 404, headers: {} },
  {
    body: "redirect",
    status: 302,
    expected: 503,
    headers: { location: "https://evil.test/" },
  },
  {
    body: JSON.stringify({ ...wh, tooltip: "<h1>Challenge</h1>" }),
    status: 200,
    expected: 502,
    headers: {},
  },
  {
    body: "x",
    status: 200,
    expected: 502,
    headers: { "content-length": "600000" },
  },
  { body: "x".repeat(600000), status: 200, expected: 502, headers: {} },
])(
  "rejects missing/redirected/malformed/oversized responses",
  async (response) => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(response.body, {
          status: response.status,
          headers: response.headers as Record<string, string>,
        }),
    );
    const result = await request();
    expect(result.status).toBe(response.expected);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("manual");
  },
);
it("bounds stalled response bodies by the same overall deadline", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"name":'));
        },
      }),
    ),
  );
  const start = Date.now();
  expect((await request()).status).toBe(504);
  expect(Date.now() - start).toBeLessThan(11_000);
}, 15_000);

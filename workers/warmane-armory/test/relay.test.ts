import { env, exports } from "cloudflare:workers";
import { reset, runInDurableObject, evictDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import worker from "../src/index";
import type {
  WarmaneImportResult,
  WarmaneImportFailure,
} from "../../../src/features/import/warmane";

const name = "Barbarius";
const path = "/character/Barbarius/Icecrown/profile";
const column = (count: number, first = "") =>
  Array.from(
    { length: count },
    (_, i) =>
      `<div class="item-slot">${i === 0 && first ? `<a rel="${first}"></a>` : '<a href="#self"></a>'}</div>`,
  ).join("");
const html = `<div id="character-sheet"><div class="name">Barbarius</div><div class="level-race-class">Level 80 Orc Warrior, Icecrown</div></div><div id="character-profile"><div class="item-model"><div class="item-left">${column(8, "item=51227&amp;ench=3817&amp;gems=3628:0:3525")}</div><div class="item-right">${column(8)}</div><div class="item-bottom">${column(3)}</div></div></div>`;
const stub = () => env.PROFILES.getByName("icecrown:barbarius");
function request(mode = "auto", extra = "") {
  return exports.default.fetch(
    `https://relay.test/import?name=${name}&realm=Icecrown&mode=${mode}${extra}`,
    { headers: { Authorization: "Bearer test-only-secret" } },
  );
}
const replies: Array<{
  status: number;
  body: string;
  headers: Record<string, string>;
  delayMs: number;
  error?: Error;
}> = [];
const outbound: Array<{ url: string; redirect: RequestInit["redirect"] }> =
  [];
let unexpectedRequests = 0;
function upstream(
  status = 200,
  body = html,
  headers: Record<string, string> = {},
) {
  const reply = { status, body, headers, delayMs: 0 };
  replies.push(reply);
  return {
    delay(ms: number) {
      reply.delayMs = ms;
    },
  };
}
async function ageSnapshot(ms: number) {
  await runInDurableObject(stub(), (_instance, state) => {
    state.storage.sql.exec(
      "UPDATE profile SET retrieved_at = retrieved_at - ?",
      ms,
    );
    state.storage.sql.exec("UPDATE control SET refresh_after = 0");
  });
}
beforeEach(async () => {
  await reset();
  replies.length = 0;
  outbound.length = 0;
  unexpectedRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      outbound.push({ url: String(url), redirect: init?.redirect });
      const reply = replies.shift();
      if (!reply) {
        unexpectedRequests++;
        throw new Error("Unexpected upstream request");
      }
      if (reply.error) throw reply.error;
      if (reply.delayMs)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, reply.delayMs);
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(init.signal?.reason);
            },
            { once: true },
          );
        });
      return new Response(reply.body, {
        status: reply.status,
        headers: reply.headers,
      });
    }),
  );
});
afterEach(() => {
  expect(unexpectedRequests).toBe(0);
  expect(replies).toHaveLength(0);
  for (const call of outbound)
    expect(call).toEqual({
      url: `https://armory.warmane.com${path}`,
      redirect: "manual",
    });
  vi.unstubAllGlobals();
});
it("denies missing/wrong auth and an unconfigured secret before any upstream request", async () => {
  for (const authorization of ["", "Bearer wrong-secret"]) {
    const response = await exports.default.fetch(
      "https://relay.test/import?name=Barbarius&realm=Icecrown",
      { headers: { authorization } },
    );
    expect(response.status).toBe(401);
  }
  const response = await worker.fetch(
    new Request("https://relay.test/import"),
    { ...env, RELAY_SECRET: "" },
  );
  expect(response.status).toBe(503);
  expect(outbound).toHaveLength(0);
});
it("validates lookup and mode before fetching", async () => {
  expect((await request("invalid")).status).toBe(400);
  expect(
    (
      await exports.default.fetch(
        "https://relay.test/import?name=../x&realm=Icecrown",
        { headers: { authorization: "Bearer test-only-secret" } },
      )
    ).status,
  ).toBe(400);
});
it("cold import preserves slots and gems, then cache and saved preserve retrieval time", async () => {
  upstream();
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const live = await response.json<WarmaneImportResult>();
  expect(live.character.gear.items).toHaveLength(17);
  expect(live.character.gear.items[0]).toEqual({
    id: 51227,
    enchant: 3817,
    gems: [41398, 0, 40117],
  });
  expect(live.meta.source).toBe("live");
  for (const [mode, source] of [
    ["auto", "cache"],
    ["saved", "saved"],
  ]) {
    const result = await (await request(mode)).json<WarmaneImportResult>();
    expect(result.meta).toMatchObject({
      source,
      retrievedAt: live.meta.retrievedAt,
    });
    expect(result.meta.requestId).not.toBe(live.meta.requestId);
  }
});
it("coalesces concurrent imports into one upstream request", async () => {
  upstream().delay(100);
  const results = await Promise.all(
    Array.from({ length: 5 }, () => request("refresh")),
  );
  expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
});
it("refresh bypasses fresh cache after cooldown and repeated refresh is limited", async () => {
  upstream();
  await request();
  expect((await request("refresh")).status).toBe(429);
  await ageSnapshot(10001);
  upstream(200, html.replace("item=51227", "item=51228"));
  const refresh = await (await request("refresh")).json<WarmaneImportResult>();
  expect(refresh.meta.source).toBe("live");
  expect(refresh.character.gear.items[0].id).toBe(51228);
});
it("invalid live HTML preserves a good profile and only offers saved metadata", async () => {
  upstream();
  await request();
  await ageSnapshot(61000);
  upstream(200, "<html>challenge</html>");
  const response = await request();
  expect(response.status).toBe(502);
  const failure = await response.json<WarmaneImportFailure>();
  expect(failure).toMatchObject({
    code: "warmaneInvalidProfile",
    saved: { retrievedAt: expect.any(String) },
  });
  expect(failure).not.toHaveProperty("character");
  expect(
    (await (await request("saved")).json<WarmaneImportResult>()).character.name,
  ).toBe(name);
});
it("saved never fetches and expires at 24 hours", async () => {
  expect(
    (await (await request("saved")).json<WarmaneImportFailure>()).code,
  ).toBe("warmaneNoSavedProfile");
  upstream();
  await request();
  await ageSnapshot(86400000);
  expect(
    (await (await request("saved")).json<WarmaneImportFailure>()).code,
  ).toBe("warmaneNoSavedProfile");
});
it("persists upstream Retry-After across object eviction", async () => {
  upstream(429, "", { "retry-after": "120" });
  const first = await request();
  expect(first.status).toBe(429);
  expect(first.headers.get("retry-after")).toBe("120");
  await evictDurableObject(stub());
  const next = await request("refresh");
  expect(next.status).toBe(429);
  expect(await next.json()).toMatchObject({
    code: "warmaneRateLimited",
    retryAfterSeconds: expect.any(Number),
  });
});
it.each([
  [403, "warmaneAccessDenied", 403],
  [404, "warmaneNotFound", 404],
  [302, "warmaneAccessDenied", 403],
])("does not retry upstream %s", async (status, code, resultStatus) => {
  upstream(Number(status), "", { location: "https://evil.test/" });
  const response = await request();
  expect(response.status).toBe(resultStatus);
  expect(await response.json()).toMatchObject({ code });
});
it("recovers with exactly one retry for transient 503", async () => {
  upstream(503, "unavailable");
  upstream();
  expect((await request()).status).toBe(200);
});
it("caps retries at two total attempts", async () => {
  upstream(502, "unavailable");
  upstream(502, "unavailable");
  expect((await (await request()).json<WarmaneImportFailure>()).code).toBe(
    "warmaneUnavailable",
  );
});
it("honors Retry-After on 503 without a premature retry", async () => {
  upstream(503, "", { "retry-after": "90" });
  const response = await request();
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("90");
  expect((await request()).status).toBe(503);
});
it.each<Record<string, string>>([{}, { "content-length": "512001" }])(
  "caps streamed and advertised body size",
  async (headers) => {
    upstream(200, "x".repeat(512001), headers);
    expect((await (await request()).json<WarmaneImportFailure>()).code).toBe(
      "warmaneInvalidProfile",
    );
  },
);
it("bounds stalled upstream headers by one overall 12-second deadline", async () => {
  upstream().delay(13000);
  const started = Date.now();
  const response = await request();
  expect(response.status).toBe(504);
  expect(await response.json()).toMatchObject({ code: "warmaneTimeout" });
  expect(Date.now() - started).toBeLessThan(12500);
});

it("recovers a network failure once without leaking the error message", async () => {
  replies.push({
    status: 0,
    body: "",
    headers: {},
    delayMs: 0,
    error: new TypeError("private network internals"),
  });
  upstream();
  const response = await request();
  expect(response.status).toBe(200);
  expect(outbound).toHaveLength(2);
  expect(await response.text()).not.toContain("private network internals");
});
it("keeps the saved snapshot across eviction and fetch failures", async () => {
  upstream();
  const first = await (await request()).json<WarmaneImportResult>();
  await ageSnapshot(61000);
  await evictDurableObject(stub());
  upstream(403, "private challenge content");
  const denied = await request();
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain("private challenge content");
  const saved = await (await request("saved")).json<WarmaneImportResult>();
  expect(saved.character).toEqual(first.character);
  expect(saved.meta.source).toBe("saved");
});
it("handles HTTP-date Retry-After and safely caps response delay without shortening stored cooldown", async () => {
  upstream(429, "", {
    "retry-after": new Date(Date.now() + 172800000).toUTCString(),
  });
  const response = await request();
  expect(response.headers.get("retry-after")).toBe("86400");
  await evictDurableObject(stub());
  await runInDurableObject(stub(), (_instance, state) => {
    const control = state.storage.sql
      .exec<{ retry_until: number }>("SELECT retry_until FROM control")
      .one();
    expect(control.retry_until - Date.now()).toBeGreaterThan(172000000);
  });
  expect((await request()).headers.get("retry-after")).toBe("86400");
});

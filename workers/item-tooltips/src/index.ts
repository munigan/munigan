import { DurableObject } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import {
  ItemTooltipSchema,
  type ItemTooltipResponse,
  type TooltipVersion,
} from "../../../src/domain/tooltips/contracts";
import { fetchItem, UpstreamError } from "./upstream";

const FRESH_MS = 7 * 86_400_000;
type Snapshot = { item: string; fetched_at: number };
type Control = { retry_until: number; status: number };
type Failure = {
  code: "tooltipUnavailable" | "tooltipNotFound";
  retryAfterSeconds: number;
};
type Outcome = {
  status: number;
  body: ItemTooltipResponse | Failure;
  refresh?: boolean;
};
const fail = (status = 503, seconds = 300): Outcome => ({
  status,
  body: {
    code: status === 404 ? "tooltipNotFound" : "tooltipUnavailable",
    retryAfterSeconds: Math.max(1, seconds),
  },
});

export class ItemTooltipCache extends DurableObject<Env> {
  private inFlight?: Promise<Outcome>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), item TEXT NOT NULL, fetched_at INTEGER NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK (id = 1), retry_until INTEGER NOT NULL, status INTEGER NOT NULL)",
    );
  }
  private saved(): Snapshot | undefined {
    return this.ctx.storage.sql
      .exec<Snapshot>("SELECT item, fetched_at FROM snapshot WHERE id = 1")
      .toArray()[0];
  }
  private blocked(): Outcome | undefined {
    const control = this.ctx.storage.sql
      .exec<Control>("SELECT retry_until, status FROM control WHERE id = 1")
      .toArray()[0];
    return control && control.retry_until > Date.now()
      ? fail(
          control.status,
          Math.ceil((control.retry_until - Date.now()) / 1000),
        )
      : undefined;
  }
  private response(saved: Snapshot): Outcome {
    const fresh = Date.now() - saved.fetched_at < FRESH_MS;
    return {
      status: 200,
      body: {
        item: ItemTooltipSchema.parse(JSON.parse(saved.item)),
        meta: {
          fetchedAt: new Date(saved.fetched_at).toISOString(),
          cache: fresh ? "fresh" : "stale",
        },
      },
      refresh: !fresh && !this.blocked(),
    };
  }
  async lookup(version: TooltipVersion, id: number): Promise<Outcome> {
    const saved = this.saved();
    if (saved) return this.response(saved);
    return this.refresh(version, id);
  }
  async refresh(version: TooltipVersion, id: number): Promise<Outcome> {
    const saved = this.saved();
    if (saved && Date.now() - saved.fetched_at < FRESH_MS)
      return this.response(saved);
    if (this.inFlight) return this.inFlight;
    const blocked = this.blocked();
    if (blocked) return saved ? this.response(saved) : blocked;
    // Assigned before any await: requests sharing this DO also share cold loads
    // and background refreshes. Storage survives isolate eviction.
    this.inFlight = this.load(version, id).finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async load(version: TooltipVersion, id: number): Promise<Outcome> {
    try {
      const item = await fetchItem(version, id);
      const saved = { item: JSON.stringify(item), fetched_at: Date.now() };
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO snapshot (id,item,fetched_at) VALUES (1,?,?)",
        saved.item,
        saved.fetched_at,
      );
      this.ctx.storage.sql.exec("DELETE FROM control");
      console.info(
        JSON.stringify({
          event: "tooltip.refresh",
          version,
          id,
          outcome: "success",
        }),
      );
      return this.response(saved);
    } catch (error) {
      const failure =
        error instanceof UpstreamError ? error : new UpstreamError();
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO control (id,retry_until,status) VALUES (1,?,?)",
        Date.now() + failure.retrySeconds * 1000,
        failure.status,
      );
      console.warn(
        JSON.stringify({
          event: "tooltip.refresh",
          version,
          id,
          outcome: "failed",
          status: failure.status,
        }),
      );
      const saved = this.saved();
      return saved
        ? this.response(saved)
        : fail(failure.status, failure.retrySeconds);
    }
  }
}
function json(outcome: Outcome) {
  return Response.json(outcome.body, {
    status: outcome.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...("retryAfterSeconds" in outcome.body
        ? { "Retry-After": String(outcome.body.retryAfterSeconds) }
        : {}),
    },
  });
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (!env.RELAY_SECRET) return json(fail());
    const expected = new TextEncoder().encode(`Bearer ${env.RELAY_SECRET}`);
    const supplied = new TextEncoder().encode(
      request.headers.get("authorization") ?? "",
    );
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return Response.json(
        { code: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    if (request.method !== "GET")
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET", "Cache-Control": "no-store" },
      });
    const url = new URL(request.url);
    const match = /^\/v1\/items\/(classic|original)\/([1-9]\d{0,6})$/.exec(
      url.pathname,
    );
    if (!match || Number(match[2]) > 1_000_000 || url.search)
      return Response.json(
        { code: "invalidInput" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    const version = match[1] as TooltipVersion,
      id = Number(match[2]);
    try {
      // Parser revision 2 classifies standalone slots (e.g. Trinket) correctly.
      const stub = env.ITEMS.getByName(`v1-p2:${version}:${id}`);
      const result = await stub.lookup(version, id);
      // Keep the RPC alive in the caller. Durable Object waitUntil itself does
      // not extend lifetime; the worker's waitUntil owns background completion.
      if (result.refresh)
        ctx.waitUntil(
          stub.refresh(version, id).then(
            () => {},
            () => {
              console.warn(
                JSON.stringify({
                  event: "tooltip.refresh-rpc-failed",
                  version,
                  id,
                }),
              );
            },
          ),
        );
      return json(result);
    } catch {
      return json(fail());
    }
  },
} satisfies ExportedHandler<Env>;

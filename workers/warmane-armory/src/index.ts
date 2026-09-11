import { DurableObject } from "cloudflare:workers";
import { AppError } from "../../../src/i18n/error";
import {
  validateWarmaneLookup,
  type ArmoryCharacter,
  type WarmaneLookup,
  type WarmaneImportMode,
  type WarmaneImportResult,
  type WarmaneImportFailure,
} from "../../../src/features/import/warmane";
import { WarmaneError } from "../../../src/server/warmane/profile";
import { fetchProfile, UpstreamError } from "./upstream";

type Outcome = {
  status: number;
  body: WarmaneImportResult | WarmaneImportFailure;
};
type Snapshot = { character: string; retrieved_at: number };
type Control = {
  refresh_after: number;
  retry_until: number;
  code: string;
  message: string;
  status: number;
};
type LiveOutcome =
  { character: ArmoryCharacter; retrievedAt: string } | { error: AppError };
function failure(
  error: AppError,
  requestId: string,
  saved?: Snapshot,
  seconds?: number,
): Outcome {
  seconds = seconds ? Math.min(86_400, seconds) : undefined;
  return {
    status: error instanceof WarmaneError ? error.status : 400,
    body: {
      code: error.code,
      message: error.message,
      ...(error.params ? { params: error.params } : {}),
      requestId,
      ...(seconds
        ? { retryAfterSeconds: seconds, params: { ...error.params, seconds } }
        : {}),
      ...(saved
        ? { saved: { retrievedAt: new Date(saved.retrieved_at).toISOString() } }
        : {}),
    },
  };
}
function json(outcome: Outcome): Response {
  const retry =
    "retryAfterSeconds" in outcome.body
      ? outcome.body.retryAfterSeconds
      : undefined;
  return Response.json(outcome.body, {
    status: outcome.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id":
        "meta" in outcome.body
          ? outcome.body.meta.requestId
          : outcome.body.requestId,
      ...(retry ? { "Retry-After": String(retry) } : {}),
    },
  });
}
const relayUnavailable = () =>
  new WarmaneError(
    "warmaneRelayUnavailable",
    "The Armory import service is temporarily unavailable. Your input has been kept.",
    503,
  );

export class WarmaneProfile extends DurableObject<Env> {
  private inFlight?: Promise<LiveOutcome>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), character TEXT NOT NULL, retrieved_at INTEGER NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK (id = 1), refresh_after INTEGER NOT NULL, retry_until INTEGER NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL, status INTEGER NOT NULL)",
    );
  }
  private saved(): Snapshot | undefined {
    this.ctx.storage.sql.exec(
      "DELETE FROM profile WHERE retrieved_at <= ?",
      Date.now() - 86_400_000,
    );
    return this.ctx.storage.sql
      .exec<Snapshot>(
        "SELECT character, retrieved_at FROM profile WHERE id = 1",
      )
      .toArray()[0];
  }
  async lookup(
    input: WarmaneLookup,
    mode: WarmaneImportMode,
    requestId: string,
  ): Promise<Outcome> {
    const lookup = validateWarmaneLookup(input);
    const snapshot = this.saved();
    const now = Date.now();
    const cache =
      mode === "saved"
        ? "saved"
        : mode === "auto" && snapshot && now - snapshot.retrieved_at < 60_000
          ? "cache"
          : undefined;
    if (cache && snapshot) {
      console.log(JSON.stringify({ event: "warmane_cache", requestId, cache }));
      return {
        status: 200,
        body: {
          character: JSON.parse(snapshot.character),
          meta: {
            retrievedAt: new Date(snapshot.retrieved_at).toISOString(),
            source: cache,
            requestId,
          },
        },
      };
    }
    if (mode === "saved")
      return failure(
        new WarmaneError(
          "warmaneNoSavedProfile",
          "No recent saved Armory profile is available. Refresh from Armory or use an addon export.",
          404,
        ),
        requestId,
      );
    if (!this.inFlight) {
      const control = this.ctx.storage.sql
        .exec<Control>("SELECT * FROM control WHERE id = 1")
        .toArray()[0];
      if (control && control.retry_until > now) {
        const seconds = Math.ceil((control.retry_until - now) / 1000);
        // Persisted code was produced by an AppError in this class.
        const error = new WarmaneError(
          control.code as AppError["code"],
          control.message,
          control.status,
        );
        return failure(error, requestId, snapshot, seconds);
      }
      if (control && control.refresh_after > now) {
        const seconds = Math.ceil((control.refresh_after - now) / 1000);
        return failure(
          new WarmaneError(
            "warmaneBusy",
            "Please wait before refreshing this profile again.",
            429,
          ),
          requestId,
          snapshot,
          seconds,
        );
      }
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO control VALUES (1, ?, 0, ?, ?, 429)",
        now + 10_000,
        "warmaneBusy",
        "Please wait before refreshing this profile again.",
      );
      this.inFlight = this.live(lookup, requestId).finally(() => {
        this.inFlight = undefined;
      });
    } else {
      console.log(
        JSON.stringify({
          event: "warmane_cache",
          requestId,
          cache: "coalesced",
        }),
      );
    }
    const result = await this.inFlight;
    if ("error" in result)
      return failure(
        result.error,
        requestId,
        this.saved(),
        result.error instanceof UpstreamError
          ? result.error.retryAfterSeconds
          : undefined,
      );
    return {
      status: 200,
      body: {
        character: result.character,
        meta: { retrievedAt: result.retrievedAt, source: "live", requestId },
      },
    };
  }
  private async live(
    lookup: WarmaneLookup,
    requestId: string,
  ): Promise<LiveOutcome> {
    try {
      const character = await fetchProfile(lookup, requestId);
      const retrievedAt = Date.now();
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO profile VALUES (1, ?, ?)",
        JSON.stringify(character),
        retrievedAt,
      );
      return { character, retrievedAt: new Date(retrievedAt).toISOString() };
    } catch (cause) {
      const error = cause instanceof AppError ? cause : relayUnavailable();
      if (error instanceof UpstreamError && error.retryAfterSeconds) {
        this.ctx.storage.sql.exec(
          "UPDATE control SET retry_until = ?, code = ?, message = ?, status = ? WHERE id = 1",
          Date.now() + error.retryAfterSeconds * 1000,
          error.code,
          error.message,
          error.status,
        );
      }
      return { error };
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    if (!env.RELAY_SECRET) return json(failure(relayUnavailable(), requestId));
    const supplied = new TextEncoder().encode(
      request.headers.get("Authorization") ?? "",
    );
    const expected = new TextEncoder().encode(`Bearer ${env.RELAY_SECRET}`);
    if (
      supplied.byteLength !== expected.byteLength ||
      !crypto.subtle.timingSafeEqual(supplied, expected)
    )
      return json({
        status: 401,
        body: {
          code: "warmaneRelayUnavailable",
          message: "Unauthorized",
          requestId,
        },
      });
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/import")
      return json({
        status: 404,
        body: {
          code: "warmaneRelayUnavailable",
          message: "Not found",
          requestId,
        },
      });
    try {
      const lookup = validateWarmaneLookup({
        name: url.searchParams.get("name") ?? "",
        realm: url.searchParams.get("realm") ?? "",
      });
      const mode = url.searchParams.get("mode") ?? "auto";
      if (mode !== "auto" && mode !== "refresh" && mode !== "saved")
        return json({
          status: 400,
          body: {
            code: "invalidInput",
            message: "Choose a supported import mode.",
            requestId,
          },
        });
      const stub = env.PROFILES.getByName(
        `${lookup.realm.toLowerCase()}:${lookup.name.toLowerCase()}`,
      );
      return json(await stub.lookup(lookup, mode, requestId));
    } catch (error) {
      return json(
        failure(
          error instanceof AppError ? error : relayUnavailable(),
          requestId,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;

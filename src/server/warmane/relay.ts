import { randomUUID } from "node:crypto";
import { z } from "zod";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import type { DiagnosticCode } from "@/i18n/error";
import type {
  WarmaneImportFailure,
  WarmaneImportMode,
  WarmaneImportResult,
  WarmaneLookup,
} from "@/features/import/warmane";
import { WarmaneError } from "./profile";

const itemId = z.number().int().min(0).max(99_999_999);
const timestamp = z.iso.datetime();
const requestIdSchema = z.string().regex(/^[a-zA-Z0-9._:-]{1,128}$/);
const resultSchema = z.object({
  character: z.object({
    name: z.string().min(2).max(24),
    class: z.string().min(1).max(24),
    race: z.string().min(1).max(24),
    level: z.literal(80),
    gear: z.object({
      items: z
        .array(
          z.object({
            id: itemId,
            enchant: itemId,
            gems: z.array(itemId).max(4),
          }),
        )
        .length(17)
        .refine((items) => items.some((item) => item.id > 0)),
    }),
    professions: z
      .array(
        z.object({
          name: z.string().min(1).max(24),
          level: z.number().int().min(1).max(450),
        }),
      )
      .max(2),
  }),
  meta: z.object({
    retrievedAt: timestamp,
    source: z.enum(["live", "cache", "saved"]),
    requestId: requestIdSchema,
  }),
});
const failureSchema = z.object({
  code: z.enum([
    "warmaneRateLimited",
    "warmaneTimeout",
    "warmaneAccessDenied",
    "warmaneNetwork",
    "warmaneRelayUnavailable",
    "warmaneNoSavedProfile",
    "warmaneBusy",
    "warmaneUnavailable",
    "warmaneInvalidProfile",
    "warmaneNotFound",
    "warmaneUnknownGem",
    "wrathLevel",
  ]),
  requestId: requestIdSchema,
  params: z
    .object({
      seconds: z.number().int().nonnegative().optional(),
      id: itemId.optional(),
    })
    .optional(),
  retryAfterSeconds: z.number().int().nonnegative().max(86_400).optional(),
  saved: z.object({ retrievedAt: timestamp }).optional(),
});
const failureStatuses = {
  warmaneRateLimited: 429,
  warmaneTimeout: 504,
  warmaneAccessDenied: 503,
  warmaneNetwork: 503,
  warmaneRelayUnavailable: 503,
  warmaneNoSavedProfile: 404,
  warmaneBusy: 429,
  warmaneUnavailable: 503,
  warmaneInvalidProfile: 502,
  warmaneNotFound: 404,
  warmaneUnknownGem: 422,
  wrathLevel: 422,
};

export class WarmaneRelayError extends WarmaneError {
  constructor(
    public readonly failure: WarmaneImportFailure,
    status: number,
  ) {
    super(failure.code as DiagnosticCode, failure.message, status);
  }
}

export function relayUnavailable(requestId = randomUUID()) {
  return new WarmaneRelayError(
    {
      code: "warmaneRelayUnavailable",
      message: diagnostics.warmaneRelayUnavailable,
      requestId,
    },
    503,
  );
}

function retained(retrievedAt: string) {
  const age = Date.now() - Date.parse(retrievedAt);
  return age >= -5_000 && age < 86_400_000;
}

async function readJson(response: Response): Promise<unknown> {
  const maxBytes = 512_000;
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("oversized");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error("oversized");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function fetchWarmaneRelay(
  lookup: WarmaneLookup,
  mode: WarmaneImportMode,
): Promise<WarmaneImportResult> {
  const requestId = randomUUID();
  const started = Date.now();
  let relayStatus: number | undefined;
  try {
    const secret = process.env.WARMANE_RELAY_SECRET;
    const configuredUrl = process.env.WARMANE_RELAY_URL;
    if (!secret || !configuredUrl) throw new Error("configuration");
    const url = new URL(configuredUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["/", "/import"].includes(url.pathname) ||
      url.search ||
      url.hash
    ) {
      throw new Error("configuration");
    }
    url.pathname = "/import";
    url.search = new URLSearchParams({ ...lookup, mode }).toString();
    const response = await fetch(url, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        "X-Request-Id": requestId,
      },
    });
    relayStatus = response.status;
    const body = await readJson(response);
    if (!response.ok) {
      const parsed = failureSchema.safeParse(body);
      if (!parsed.success) throw new Error("response");
      const data = parsed.data;
      const params = { ...data.params };
      if (data.code === "warmaneRateLimited" || data.code === "warmaneBusy") {
        params.seconds = data.retryAfterSeconds ?? params.seconds ?? 30;
      }
      if (data.code === "warmaneUnknownGem" && params.id === undefined)
        throw new Error("response");
      const message = diagnostics[data.code].replace(
        /\{(\w+)\}/g,
        (match, name: string) =>
          String(params[name as keyof typeof params] ?? match),
      );
      const failure: WarmaneImportFailure = {
        code: data.code,
        message,
        requestId: data.requestId,
        ...(Object.keys(params).length ? { params } : {}),
        ...(data.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: data.retryAfterSeconds }
          : {}),
        ...(data.saved && retained(data.saved.retrievedAt)
          ? { saved: data.saved }
          : {}),
      };
      throw new WarmaneRelayError(failure, failureStatuses[data.code]);
    }
    const data = resultSchema.parse(body);
    if (
      data.character.name.toLowerCase() !== lookup.name.toLowerCase() ||
      !retained(data.meta.retrievedAt) ||
      (mode === "saved"
        ? data.meta.source !== "saved"
        : data.meta.source === "saved") ||
      (data.meta.source !== "saved" &&
        Date.now() - Date.parse(data.meta.retrievedAt) > 120_000)
    )
      throw new Error("response");
    console.info(
      JSON.stringify({
        event: "warmane.relay",
        requestId,
        relayRequestId: data.meta.requestId,
        relayStatus,
        durationMs: Date.now() - started,
        source: data.meta.source,
      }),
    );
    return data;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "warmane.relay",
        requestId,
        relayStatus,
        durationMs: Date.now() - started,
        code:
          error instanceof WarmaneRelayError
            ? error.code
            : "warmaneRelayUnavailable",
      }),
    );
    if (error instanceof WarmaneRelayError) throw error;
    throw relayUnavailable(requestId);
  }
}

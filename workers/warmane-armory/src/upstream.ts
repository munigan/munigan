import { AppError, type DiagnosticCode } from "../../../src/i18n/error";
import {
  parseWarmaneProfile,
  WarmaneError,
} from "../../../src/server/warmane/profile";
import type { WarmaneLookup } from "../../../src/features/import/warmane";

export class UpstreamError extends WarmaneError {
  constructor(
    code: DiagnosticCode,
    message: string,
    status: number,
    readonly retryAfterSeconds?: number,
    readonly transient = false,
  ) {
    super(
      code,
      message,
      status,
      retryAfterSeconds ? { seconds: retryAfterSeconds } : undefined,
    );
  }
}
const invalid = () =>
  new UpstreamError(
    "warmaneInvalidProfile",
    "Could not read this Armory profile completely. Try again or use an addon export.",
    502,
  );
const timeout = () =>
  new UpstreamError(
    "warmaneTimeout",
    "Warmane took too long to respond. Try again shortly or use a saved profile.",
    504,
  );
function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value.trim())
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds, 2_147_483_647)
    : undefined;
}
async function readBounded(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > 512_000) {
    await response.body?.cancel();
    throw invalid();
  }
  const reader = response.body?.getReader();
  if (!reader) throw invalid();
  const decoder = new TextDecoder();
  let size = 0,
    html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.byteLength;
      if (size > 512_000) throw invalid();
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}
export async function fetchProfile(lookup: WarmaneLookup, requestId: string) {
  const started = Date.now();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(timeout()), 12_000);
  const aborted = new Promise<never>((_, reject) =>
    controller.signal.addEventListener("abort", () => reject(timeout()), {
      once: true,
    }),
  );
  try {
    return await Promise.race([
      aborted,
      (async () => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          let status: number | null = null;
          try {
            controller.signal.throwIfAborted();
            const response = await fetch(
              `https://armory.warmane.com/character/${encodeURIComponent(lookup.name)}/${lookup.realm}/profile`,
              {
                redirect: "manual",
                signal: controller.signal,
                headers: { Accept: "text/html" },
              },
            );
            status = response.status;
            if (!response.ok) {
              await response.body?.cancel();
              const wait = retryAfter(response.headers.get("retry-after"));
              if (status === 404)
                throw new UpstreamError(
                  "warmaneNotFound",
                  "Character not found. Check the name and realm.",
                  404,
                );
              if (
                status === 401 ||
                status === 403 ||
                (status >= 300 && status < 400)
              )
                throw new UpstreamError(
                  "warmaneAccessDenied",
                  "Warmane did not allow this profile request. Try again later or use an addon export.",
                  403,
                );
              if (status === 429)
                throw new UpstreamError(
                  "warmaneRateLimited",
                  "Warmane is limiting requests. Please wait before trying again.",
                  429,
                  wait ?? 60,
                );
              throw new UpstreamError(
                "warmaneUnavailable",
                "Warmane Armory is unavailable. Try again shortly, or use an addon export.",
                503,
                wait,
                [500, 502, 503, 504].includes(status),
              );
            }
            const html = await readBounded(response);
            controller.signal.throwIfAborted();
            const character = parseWarmaneProfile(html, lookup);
            console.log(
              JSON.stringify({
                event: "warmane_upstream",
                requestId,
                status,
                elapsedMs: Date.now() - started,
                attempt,
                retryCount: attempt - 1,
                reason: "success",
                cache: "live",
              }),
            );
            return character;
          } catch (cause) {
            const error = controller.signal.aborted
              ? timeout()
              : cause instanceof AppError
                ? cause
                : new UpstreamError(
                    "warmaneNetwork",
                    "Could not connect to Warmane. Try again shortly or use a saved profile.",
                    503,
                    undefined,
                    true,
                  );
            console.log(
              JSON.stringify({
                event: "warmane_upstream",
                requestId,
                status,
                elapsedMs: Date.now() - started,
                attempt,
                retryCount: attempt - 1,
                reason: error.code,
                cache: "miss",
              }),
            );
            if (
              attempt === 2 ||
              !(error instanceof UpstreamError) ||
              !error.transient ||
              error.retryAfterSeconds ||
              controller.signal.aborted
            )
              throw error;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
        throw timeout();
      })(),
    ]);
  } finally {
    clearTimeout(deadline);
  }
}

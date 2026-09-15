import { createHash } from "node:crypto";
import { PostHog } from "posthog-node";
import { after } from "next/server";
import { sanitizeEvent, type AnalyticsEvent } from "./privacy";
export function eventUuid(event: string, key: string) {
  const hex = createHash("sha256").update(`${event}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function requestAnalyticsId(request: Request): string | null {
  const value = request.headers.get("x-analytics-id");
  return value &&
    /^(?:[a-f0-9-]{32,36}|account:[A-Za-z0-9_-]{1,128})$/.test(value)
    ? value
    : null;
}
function enabled() {
  return (
    !!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.VERCEL_ENV === "production"
  );
}
export async function captureServer(
  event: AnalyticsEvent,
  distinctId: string,
  key: string,
  properties: Record<string, unknown>,
) {
  if (!enabled()) return;
  try {
    const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      disableGeoip: true,
    });
    client.on("error", () => {});
    client.capture({
      distinctId,
      event,
      uuid: eventUuid(event, key),
      properties: {
        ...sanitizeEvent(event, properties),
        environment: "production",
        $geoip_disable: true,
      },
    });
    await client.shutdown();
  } catch {
    /* Analytics failure cannot change the outcome of a committed action. */
  }
}
export function trackAfterResponse(
  request: Request,
  event: AnalyticsEvent,
  key: string,
  properties: Record<string, unknown>,
) {
  if (!enabled()) return;
  const id = requestAnalyticsId(request);
  if (!id) return;
  try {
    after(() => captureServer(event, id, key, properties));
  } catch {
    /* no request lifecycle available */
  }
}

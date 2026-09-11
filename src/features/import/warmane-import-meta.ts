import type { WarmaneImportMeta } from "./warmane";

const sources = new Set<WarmaneImportMeta["source"]>([
  "live",
  "cache",
  "saved",
]);

export function isWarmaneImportMeta(
  value: unknown,
): value is WarmaneImportMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.retrievedAt === "string" &&
    meta.retrievedAt.includes("T") &&
    Number.isFinite(Date.parse(meta.retrievedAt)) &&
    typeof meta.source === "string" &&
    sources.has(meta.source as WarmaneImportMeta["source"]) &&
    typeof meta.requestId === "string" &&
    meta.requestId.length > 0
  );
}

export function savedProfileRetrievedAt(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const retrievedAt = (value as { saved?: { retrievedAt?: unknown } }).saved
    ?.retrievedAt;
  return typeof retrievedAt === "string" &&
    retrievedAt.includes("T") &&
    Number.isFinite(Date.parse(retrievedAt))
    ? retrievedAt
    : null;
}

export function formatWarmaneAge(
  retrievedAt: string,
  locale: string,
  now = Date.now(),
) {
  const seconds = Math.max(
    0,
    Math.round((now - Date.parse(retrievedAt)) / 1000),
  );
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}

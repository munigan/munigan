export const events = [
  "$pageview",
  "$identify",
  "gear_import_completed",
  "gear_run_requested",
  "gear_run_accepted",
  "pro_dialog_opened",
  "pro_discord_signin_clicked",
  "pro_launch_joined",
] as const;
export type AnalyticsEvent = (typeof events)[number];
export function safePath(value: string): string {
  const path = value.split(/[?#]/)[0];
  if (/^\/reports\/[^/]+\/?$/.test(path)) return "/reports/:token";
  return [
    "/",
    "/en-us",
    "/pt-br",
    "/gear-lab",
    "/raid-trainer",
    "/library",
    "/auth/return",
  ].includes(path)
    ? path
    : "/other";
}
const scalarKeys = new Set([
  "token",
  "distinct_id",
  "$anon_distinct_id",
  "$device_id",
  "$user_id",
  "$session_id",
  "$window_id",
  "$is_identified",
  "$process_person_profile",
  "$lib",
  "$lib_version",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  "$timezone",
  "$timezone_offset",
  "$host",
  "$referring_domain",
  "$geoip_disable",
  "$insert_id",
  "source",
  "locale",
  "spec_id",
  "item_version",
  "iterations",
  "selected_items",
  "auth_mode",
  "environment",
  "retry",
  "offer_version",
]);
export function sanitizeEvent(
  event: string,
  input: Record<string, unknown>,
): Record<string, string | number | boolean> | null {
  if (!(events as readonly string[]).includes(event)) return null;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "$current_url" && typeof value === "string") {
      try {
        const url = new URL(value);
        output[key] = "https://munigan.app" + safePath(url.pathname);
      } catch {
        /* omit malformed URL */
      }
    } else if (key === "$pathname" && typeof value === "string")
      output[key] = safePath(value);
    else if (key === "$referrer" && typeof value === "string") {
      try {
        output[key] = new URL(value).origin + "/";
      } catch {
        /* omit */
      }
    } else if (
      scalarKeys.has(key) &&
      (typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && value.length <= 200))
    )
      output[key] = value;
  }
  return output;
}

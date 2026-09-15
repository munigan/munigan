"use client";
import posthog from "posthog-js";
import { sanitizeEvent, safePath, type AnalyticsEvent } from "./privacy";
let initialized = false;
export function initAnalytics(): boolean {
  if (initialized) return true;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (
    !token ||
    typeof window === "undefined" ||
    window.location.hostname !== "munigan.app" ||
    navigator.doNotTrack === "1"
  )
    return false;
  try {
    posthog.init(token, {
      api_host: "https://us.i.posthog.com",
      ui_host: "https://us.posthog.com",
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      enable_heatmaps: false,
      persistence: "localStorage",
      person_profiles: "identified_only",
      save_referrer: false,
      store_google: false,
      before_send: (event) => {
        if (!event) return null;
        const properties = sanitizeEvent(event.event, event.properties);
        return properties ? { ...event, properties } : null;
      },
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}
export function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean> = {},
) {
  try {
    if (!initAnalytics()) return;
    posthog.capture(event, {
      ...properties,
      locale: document.documentElement.lang,
      environment: "production",
      $geoip_disable: true,
    });
  } catch {
    /* Analytics must never interrupt a product action. */
  }
}
export function trackPage(path: string) {
  track("$pageview", {
    $current_url: "https://munigan.app" + safePath(path),
    $pathname: safePath(path),
    $referrer: document.referrer,
  });
}
export function identifyAccount(id: string | null) {
  try {
    if (!initAnalytics()) return;
    if (id) {
      if (posthog.get_distinct_id() !== `account:${id}`)
        posthog.identify(`account:${id}`);
    } else if (posthog.get_distinct_id().startsWith("account:"))
      posthog.reset();
  } catch {
    /* fail open */
  }
}
export function analyticsHeaders(): Record<string, string> {
  try {
    if (!initAnalytics()) return {};
    return { "x-analytics-id": posthog.get_distinct_id() };
  } catch {
    return {};
  }
}

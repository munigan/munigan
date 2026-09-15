import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ capture: vi.fn(), shutdown: vi.fn() }));
vi.mock("posthog-node", () => ({
  PostHog: class {
    on = vi.fn();
    capture = mocks.capture;
    shutdown = mocks.shutdown;
  },
}));
import { captureServer, eventUuid, requestAnalyticsId } from "./server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("does nothing without production configuration", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  await captureServer("gear_run_accepted", "abc", "job", {});
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("deduplicates event identity and ignores malformed analytics IDs", () => {
  expect(eventUuid("gear_run_accepted", "job")).toBe(
    eventUuid("gear_run_accepted", "job"),
  );
  expect(eventUuid("gear_run_accepted", "job")).not.toBe(
    eventUuid("pro_launch_joined", "job"),
  );
  expect(
    requestAnalyticsId(
      new Request("https://munigan.app", {
        headers: { "x-analytics-id": "secret@email.com" },
      }),
    ),
  ).toBeNull();
});
it("swallows network failures and strips unknown fields", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.shutdown.mockRejectedValueOnce(new Error("offline"));
  await expect(
    captureServer("gear_run_accepted", "anon", "job", {
      character: "secret",
      iterations: 500,
    }),
  ).resolves.toBeUndefined();
  expect(mocks.capture.mock.calls[0][0].properties.character).toBeUndefined();
});

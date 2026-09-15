import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(() => "01994111-1234-4123-a123-0123456789ab"),
}));
vi.mock("posthog-js", () => ({ default: mocks }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});
it("does not initialize or track on localhost", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  const { track, analyticsHeaders } = await import("./client");
  track("pro_dialog_opened", { source: "header" });
  expect(mocks.init).not.toHaveBeenCalled();
  expect(analyticsHeaders()).toEqual({});
});
it("uses explicit capture and sanitizes URLs before transmission", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubGlobal("window", { location: { hostname: "munigan.app" } });
  const { track, analyticsHeaders } = await import("./client");
  track("pro_dialog_opened", { source: "header" });
  expect(mocks.init).toHaveBeenCalledWith(
    "phc_test",
    expect.objectContaining({
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      capture_exceptions: false,
    }),
  );
  const config = mocks.init.mock.calls[0][1];
  expect(
    config.before_send({
      event: "$pageview",
      properties: {
        $current_url: "https://munigan.app/reports/private?key=secret",
        $set: { email: "secret" },
      },
    }).properties,
  ).toEqual({ $current_url: "https://munigan.app/reports/:token" });
  expect(analyticsHeaders()).toEqual({
    "x-analytics-id": "01994111-1234-4123-a123-0123456789ab",
  });
});
it("respects Do Not Track", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubGlobal("window", { location: { hostname: "munigan.app" } });
  vi.stubGlobal("navigator", { doNotTrack: "1" });
  const { track } = await import("./client");
  track("gear_run_requested");
  expect(mocks.init).not.toHaveBeenCalled();
});
it("SDK failures cannot break product actions", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubGlobal("window", { location: { hostname: "munigan.app" } });
  mocks.init.mockImplementationOnce(() => {
    throw new Error("unavailable");
  });
  const { track } = await import("./client");
  expect(() => track("pro_dialog_opened")).not.toThrow();
});

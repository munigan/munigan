import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), dispatch: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./dispatch", () => ({ dispatchPendingJobs: mocks.dispatch }));
import { wakeDispatcher } from "./wake";
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("leaves native local execution alone when Trigger is not configured", () => {
  vi.stubEnv("TRIGGER_SECRET_KEY", "");
  wakeDispatcher();
  expect(mocks.after).not.toHaveBeenCalled();
});
it("dispatches only after the accepted response", async () => {
  vi.stubEnv("TRIGGER_SECRET_KEY", "test");
  vi.stubEnv("TRIGGER_PROJECT_REF", "test");
  wakeDispatcher();
  expect(mocks.dispatch).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.dispatch).toHaveBeenCalledOnce();
});
it("does not turn accepted durable jobs into failed requests when dispatch fails", async () => {
  vi.stubEnv("TRIGGER_SECRET_KEY", "test");
  vi.stubEnv("TRIGGER_PROJECT_REF", "test");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.dispatch.mockRejectedValueOnce(new Error("provider unavailable"));
  wakeDispatcher();
  await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
  log.mockRestore();
});

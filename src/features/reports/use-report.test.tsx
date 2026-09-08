import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReport } from "./use-report";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const response = (status: number, body: unknown) => ({
  ok: status === 200,
  status,
  json: async () => body,
});

it("pauses hidden reports, resumes on visibility and stops at completion", async () => {
  vi.useFakeTimers();
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const fetch = vi
    .fn()
    .mockResolvedValue(response(200, { report: { status: "running" } }));
  vi.stubGlobal("fetch", fetch);
  renderHook(() => useReport("/report"));
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(1);
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValue(response(200, { report: { status: "complete" } }));
  hidden = false;
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("retains received data through temporary errors but stops polling an expired link", async () => {
  vi.useFakeTimers();
  const running = { report: { status: "running" } };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(200, running))
    .mockResolvedValueOnce(response(503, { error: "Temporarily unavailable" }))
    .mockResolvedValue(response(410, { error: "This report has expired" }));
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useReport("/report"));
  await act(async () => {});
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(result.current.data).toEqual(running);
  expect(result.current.error).toContain("Temporarily unavailable");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.data).toBeNull();
  expect(result.current.error).toContain("expired");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(fetch).toHaveBeenCalledTimes(3);
});

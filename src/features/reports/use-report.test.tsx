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

it("keeps the displayed page and its URL through a failed pagination request", async () => {
  const first = { report: { status: "complete" }, page: 0 };
  let release!: (value: ReturnType<typeof response>) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(response(200, first))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      ),
  );
  const { result, rerender } = renderHook(
    ({ url }) => useReport(url, "report-a"),
    {
      initialProps: { url: "/report-a?cursor=0" },
    },
  );
  await act(async () => {});
  rerender({ url: "/report-a?cursor=20" });
  expect(result.current.data).toEqual(first);
  expect(result.current.url).toBe("/report-a?cursor=0");
  expect(result.current.isPending).toBe(true);
  await act(async () => {
    release(response(503, { error: "Try again shortly" }));
  });
  expect(result.current.data).toEqual(first);
  expect(result.current.url).toBe("/report-a?cursor=0");
  expect(result.current.error).toBe("Try again shortly");
  expect(result.current.isPending).toBe(false);
});

it("never shows another report's data and ignores late aborted pages", async () => {
  const first = { report: { status: "complete" }, name: "First" };
  const second = { report: { status: "complete" }, name: "Second" };
  let releasePage!: (value: ReturnType<typeof response>) => void;
  let releaseReport!: (value: ReturnType<typeof response>) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(response(200, first))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releasePage = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseReport = resolve;
          }),
      ),
  );
  const { result, rerender } = renderHook(
    ({ url, key }) => useReport(url, key),
    {
      initialProps: { url: "/report-a?cursor=0", key: "a" },
    },
  );
  await act(async () => {});
  rerender({ url: "/report-a?cursor=20", key: "a" });
  expect(result.current.data).toEqual(first);
  rerender({ url: "/report-b?cursor=0", key: "b" });
  expect(result.current.data).toBeNull();
  await act(async () => {
    releaseReport(response(200, second));
  });
  await act(async () => {
    releasePage(response(200, first));
  });
  expect(result.current.data).toEqual(second);
  expect(result.current.url).toBe("/report-b?cursor=0");
});

it("retains structured API diagnostics while keeping the legacy error string", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response(410, {
        error: "This report has expired",
        code: "reportExpired",
        params: {},
      }),
    ),
  );
  const { result } = renderHook(() => useReport("/report"));
  await act(async () => {});
  expect(result.current.error).toBe("This report has expired");
  expect(result.current.diagnostic).toEqual({
    message: "This report has expired",
    code: "reportExpired",
    params: {},
  });
});

it("refreshes terminal data and invalidates permissions synchronously on identity changes", async () => {
  const initial = {
    report: { status: "complete" },
    access: { canManage: true },
  };
  let resolve!: (value: unknown) => void;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(200, initial))
    .mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  vi.stubGlobal("fetch", fetch);
  const { result, rerender } = renderHook(
    ({ identity }) => useReport("/report", "report", identity),
    { initialProps: { identity: "account-a" } },
  );
  await act(async () => {});
  expect(result.current.permissionsFresh).toBe(true);
  rerender({ identity: "anonymous" });
  expect(result.current.permissionsFresh).toBe(false);
  expect(result.current.data).toEqual(initial);
  await act(async () =>
    resolve(
      response(200, {
        report: { status: "complete" },
        access: { canManage: false },
      }),
    ),
  );
  expect(result.current.permissionsFresh).toBe(true);
  act(() => result.current.refresh());
  expect(result.current.permissionsFresh).toBe(false);
  expect(result.current.data).not.toBeNull();
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("invalidates terminal report permissions when a report is deleted in this browser", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const { invalidateAccountData } =
    await import("@/features/auth/data-invalidation");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(200, { report: { status: "complete" } }))
    .mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() =>
    useReport("/report", "/report", "account-a"),
  );
  await act(async () => {});
  expect(result.current.permissionsFresh).toBe(true);
  act(() => invalidateAccountData());
  expect(result.current.permissionsFresh).toBe(false);
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(2);
});

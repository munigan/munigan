// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  createAttempt,
  submitAttempt,
  loadAttempt,
  canSwitchMode,
} from "./admission-attempt";
beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
it("sends account admission explicitly and permits anonymous continuation only after a known rejection", async () => {
  const attempt = createAttempt({ tool: "top-gear" }, "account");
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ code: "SIGN_IN_REQUIRED" }),
  });
  vi.stubGlobal("fetch", fetch);
  await expect(submitAttempt(attempt)).rejects.toThrow();
  expect(canSwitchMode(attempt)).toBe(true);
  expect(JSON.parse(fetch.mock.calls[0][1].body).authMode).toBe("account");
  const next = createAttempt({ tool: "top-gear" }, "anonymous");
  expect(next.key).not.toBe(attempt.key);
});
it("retains mode, immutable payload and key through network uncertainty, reload and later auth rejection", async () => {
  const attempt = createAttempt({ tool: "top-gear" }, "account");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  await expect(submitAttempt(attempt)).rejects.toThrow();
  expect(canSwitchMode(attempt)).toBe(false);
  const restored = loadAttempt()!;
  expect(restored).toEqual(attempt);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ code: "AUTH_UNAVAILABLE" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reportUrl: "/reports/abc" }),
    });
  vi.stubGlobal("fetch", fetch);
  await expect(submitAttempt(restored)).rejects.toThrow();
  expect(canSwitchMode(restored)).toBe(false);
  expect(await submitAttempt(restored)).toBe("/reports/abc");
  expect(loadAttempt()).toBeNull();
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  expect(fetch.mock.calls[0][1].headers["idempotency-key"]).toBe(attempt.key);
});
it("treats generic 503 responses as uncertain and never sends if session storage cannot preserve the intent", async () => {
  const attempt = createAttempt({ tool: "top-gear" }, "account");
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({ code: "serviceUnavailable" }),
  });
  vi.stubGlobal("fetch", fetch);
  await expect(submitAttempt(attempt)).rejects.toThrow();
  expect(canSwitchMode(attempt)).toBe(false);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage");
  });
  await expect(submitAttempt(attempt)).rejects.toThrow("storage");
  expect(fetch).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});

it.each([
  "allowance",
  "invalidInput",
  "purchaseNoLegalSets",
  "purchaseAllowanceExceeded",
  "purchaseSearchLimit",
  "purchaseCatalogChanged",
  "purchaseEnhancementInvalid",
])(
  "recognizes definitive initial 422 %s without unlocking an earlier ambiguous attempt",
  async (code) => {
    const attempt = createAttempt({ tool: "top-gear" }, "account");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ code }),
      }),
    );
    await expect(submitAttempt(attempt)).rejects.toThrow();
    expect(canSwitchMode(attempt)).toBe(true);
    attempt.status = "uncertain";
    await expect(submitAttempt(attempt)).rejects.toThrow();
    expect(canSwitchMode(attempt)).toBe(false);
  },
);
it("keeps unknown first 422 failures uncertain", async () => {
  const attempt = createAttempt({ tool: "top-gear" }, "account");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: "Unexpected infrastructure failure" }),
    }),
  );
  await expect(submitAttempt(attempt)).rejects.toThrow();
  expect(canSwitchMode(attempt)).toBe(false);
});

// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  safeReturnPath,
  storeReturnState,
  loadReturnState,
  clearReturnState,
  storeSignInReturn,
  loadSignInReturn,
  validOAuthCallback,
} from "./return-state";
const key = "a".repeat(43);
const state = {
  version: 1 as const,
  reportPath: "/reports/abc",
  locale: "en-US" as const,
  cursor: 20,
  selectedId: "row",
  difference: "highest" as const,
  scrollY: 400,
};
beforeEach(() => sessionStorage.clear());
it("accepts safe final paths and strips all query and hash secrets", () => {
  for (const path of [
    "//evil.example/path",
    "https://evil.example",
    "/api/auth/error",
    "/auth/return?flow=x",
    "/\\evil",
    "/%2f%2fevil",
    "/api/%61uth/error",
  ])
    expect(safeReturnPath(path, "https://munigan.app")).toBe("/gear-lab");
  expect(
    safeReturnPath("/reports/abc?auth=secret#token", "https://munigan.app"),
  ).toBe("/reports/abc");
  expect(safeReturnPath("/pt-br", "https://munigan.app")).toBe("/pt-br");
});
it("separates controlled OAuth callbacks from final destinations", () => {
  expect(validOAuthCallback(`/auth/return?intent=${key}`)).toBe(true);
  for (const path of [
    "/auth/return",
    "/auth/return?flow=x",
    "/auth/return?flow=" + key + "&intent=" + key,
    "/api/auth/error",
    "//evil",
  ])
    expect(validOAuthCallback(path)).toBe(false);
});
it("round trips independent payload shapes and consumes explicitly", () => {
  storeReturnState(key, state);
  storeSignInReturn(key, {
    returnPath: "/library?auth=secret",
    locale: "pt-BR",
  });
  expect(loadReturnState(key)).toEqual(state);
  expect(loadSignInReturn(key)?.returnPath).toBe("/library");
  clearReturnState(key);
  expect(loadReturnState(key)).toBeNull();
  expect(loadSignInReturn(key)).not.toBeNull();
});
it("rejects hostile or expired stored values", () => {
  for (const patch of [
    { cursor: 1 },
    { scrollY: -1 },
    { scrollY: 1e9 },
    { locale: "evil" },
    { difference: "evil" },
    { selectedId: "a".repeat(513) },
    { version: 2 },
    { reportPath: "/auth/return" },
  ]) {
    expect(() =>
      storeReturnState(key, { ...state, ...patch } as typeof state),
    ).toThrow();
  }
  storeReturnState(key, state);
  const storageKey = sessionStorage.key(0)!;
  sessionStorage.setItem(storageKey, "{");
  expect(loadReturnState(key)).toBeNull();
  storeReturnState(key, state);
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
  expect(loadReturnState(key)).toBeNull();
  vi.restoreAllMocks();
});
it("surfaces storage failures before OAuth navigation", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => storeReturnState(key, state)).toThrow("blocked");
  vi.restoreAllMocks();
});

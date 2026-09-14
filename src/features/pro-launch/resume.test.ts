// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  consumeProLaunchResume,
  hasProLaunchResume,
  storeProLaunchResume,
} from "./resume";

const storageKey = "munigan.pro-launch.resume";

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

it("consumes a verified resume only once for the same user and route", () => {
  storeProLaunchResume({
    userId: "account-a",
    returnPath: "/gear-lab",
    source: "header",
  });
  expect(consumeProLaunchResume("account-a", "/gear-lab")).toEqual({
    source: "header",
  });
  expect(consumeProLaunchResume("account-a", "/gear-lab")).toBeNull();
});

it("checks presence without consuming or exposing identity", () => {
  storeProLaunchResume({
    userId: "account-secret",
    returnPath: "/gear-lab",
    source: "iterations_limit",
  });
  expect(hasProLaunchResume("/gear-lab?ignored=1")).toBe(true);
  expect(consumeProLaunchResume("account-secret", "/gear-lab")).toEqual({
    source: "iterations_limit",
  });
});

it.each([
  ["different user", "account-b", "/gear-lab"],
  ["different route", "account-a", "/library"],
])("removes a marker for a %s", (_case, userId, returnPath) => {
  storeProLaunchResume({
    userId: "account-a",
    returnPath: "/gear-lab",
    source: "gear_limit",
  });
  expect(consumeProLaunchResume(userId, returnPath)).toBeNull();
  expect(sessionStorage.getItem(storageKey)).toBeNull();
});

it.each([
  ["malformed JSON", "{"],
  ["oversized record", "x".repeat(4097)],
  [
    "invalid source",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60_000,
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "unknown",
    }),
  ],
  [
    "unexpected fields",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60_000,
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "header",
      joined: true,
    }),
  ],
  [
    "unsafe route",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60_000,
      userId: "account-a",
      returnPath: "//evil.example",
      source: "header",
    }),
  ],
  [
    "oversized user",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60_000,
      userId: "a".repeat(129),
      returnPath: "/gear-lab",
      source: "header",
    }),
  ],
  [
    "expired timestamp",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() - 1,
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "header",
    }),
  ],
  [
    "fabricated future expiry",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 6 * 60_000,
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "header",
    }),
  ],
])("rejects and removes %s", (_case, raw) => {
  sessionStorage.setItem(storageKey, raw);
  expect(hasProLaunchResume("/gear-lab")).toBe(false);
  expect(sessionStorage.getItem(storageKey)).toBeNull();
});

it("rejects oversized input before storage", () => {
  for (const input of [
    { userId: "a".repeat(129), returnPath: "/gear-lab" },
    { userId: "account-a", returnPath: "//evil.example" },
  ])
    expect(() => storeProLaunchResume({ ...input, source: "header" })).toThrow(
      "Invalid PRO launch resume",
    );
});

it("propagates write failures and contains read and removal failures", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  expect(() =>
    storeProLaunchResume({
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "header",
    }),
  ).toThrow("storage blocked");
  vi.restoreAllMocks();

  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  expect(hasProLaunchResume("/gear-lab")).toBe(false);
  expect(consumeProLaunchResume("account-a", "/gear-lab")).toBeNull();
  vi.restoreAllMocks();

  sessionStorage.setItem(storageKey, "{");
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  expect(hasProLaunchResume("/gear-lab")).toBe(false);
  expect(consumeProLaunchResume("account-a", "/gear-lab")).toBeNull();
});

it("never performs a network request", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  storeProLaunchResume({
    userId: "account-a",
    returnPath: "/gear-lab",
    source: "header",
  });
  expect(consumeProLaunchResume("account-a", "/gear-lab")).toEqual({
    source: "header",
  });
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

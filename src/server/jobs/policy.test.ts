import { afterEach, expect, it, vi } from "vitest";
import { workPolicy } from "./policy";
import { allowanceForCount } from "@/domain/equipment/enumerate";

afterEach(() => vi.unstubAllEnvs());

it("allows 120 free sets and refuses 121 under the default policy", () => {
  vi.stubEnv("TOP_GEAR_MAX_UNITS", undefined);
  vi.stubEnv("APP_ENV", "local");
  const policy = workPolicy();
  expect(policy.maxUnits! / policy.unitsPerSet).toBe(120);
  expect(allowanceForCount(120, policy).allowed).toBe(true);
  expect(allowanceForCount(121, policy).allowed).toBe(false);
});

it("removes local combination and search admission caps only with the explicit opt-in", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("LOCAL_UNLIMITED_ADMISSION", "1");
  const policy = workPolicy();
  expect(allowanceForCount(1000000, policy).allowed).toBe(true);
  const { createSearchBudget } =
    await import("@/domain/equipment/search-budget");
  const budget = createSearchBudget(policy.maxSearchNodes);
  expect(() => {
    for (let i = 0; i < 100001; i++) budget.visit();
  }).not.toThrow();
  expect(JSON.parse(JSON.stringify(policy))).toMatchObject({
    maxUnits: null,
    maxSearchNodes: null,
    maxJobSeconds: null,
  });
});

it.each([
  ["production", "local", "1"],
  ["production", "production", "1"],
  ["development", "staging", "1"],
  ["development", "local", undefined],
])(
  "retains admission caps in %s/%s with opt-in %s",
  (nodeEnv, appEnv, optIn) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("APP_ENV", appEnv);
    vi.stubEnv("LOCAL_UNLIMITED_ADMISSION", optIn);
    vi.stubEnv("TOP_GEAR_MAX_UNITS", "600000");
    expect(allowanceForCount(121, workPolicy()).allowed).toBe(false);
  },
);

it("accepts selected iterations only locally and bounds the actual finite workload", () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("LOCAL_UNLIMITED_ADMISSION", "1");
  vi.stubEnv("TOP_GEAR_ITERATIONS", undefined);
  expect(workPolicy().iterationsPerSet).toBe(500);
  expect(workPolicy(6000).iterationsPerSet).toBe(6000);
  for (const value of [0, 499, 501, 6500, Infinity])
    expect(() => workPolicy(value)).toThrow();
  vi.stubEnv("APP_ENV", "production");
  expect(() => workPolicy(6000)).toThrow();
  vi.stubEnv("TOP_GEAR_ITERATIONS", "1500");
  expect(workPolicy().iterationsPerSet).toBe(1500);
});

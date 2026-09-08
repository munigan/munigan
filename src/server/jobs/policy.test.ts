import { afterEach, expect, it, vi } from "vitest";
import { workPolicy } from "./policy";
import { allowanceForCount } from "@/domain/equipment/enumerate";

afterEach(() => vi.unstubAllEnvs());

it("allows 120 free sets and refuses 121 under the default policy", () => {
  vi.stubEnv("TOP_GEAR_MAX_UNITS", undefined);
  vi.stubEnv("APP_ENV", "local");
  const policy = workPolicy();
  expect(policy.maxUnits / policy.unitsPerSet).toBe(120);
  expect(allowanceForCount(120, policy).allowed).toBe(true);
  expect(allowanceForCount(121, policy).allowed).toBe(false);
});

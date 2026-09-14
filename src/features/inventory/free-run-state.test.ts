import { expect, it } from "vitest";
import { allowanceForCount } from "@/domain/equipment/enumerate";
import type { WorkPolicy } from "@/domain/top-gear/model";
import { isCombinationLimitExceeded } from "./free-run-state";

const policy: WorkPolicy = {
  version: "test",
  unitsPerSet: 5000,
  maxUnits: 600000,
  iterationsPerSet: 500,
  maxSearchNodes: 100000,
  maxJobSeconds: 900,
  maxAttempts: 2,
};

it.each([
  [0, false],
  [96, false],
  [120, false],
  [121, true],
] as const)(
  "reports whether %i combinations exceed the free limit",
  (count, expected) => {
    expect(
      isCombinationLimitExceeded(policy, allowanceForCount(count, policy)),
    ).toBe(expected);
  },
);

it("does not infer a paid limit from missing policy or a disallowed empty selection", () => {
  expect(isCombinationLimitExceeded(null, allowanceForCount(121, policy))).toBe(
    false,
  );
  expect(isCombinationLimitExceeded(policy, allowanceForCount(0, policy))).toBe(
    false,
  );
});

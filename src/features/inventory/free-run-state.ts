import type { Allowance, WorkPolicy } from "@/domain/top-gear/model";

export function isCombinationLimitExceeded(
  policy: WorkPolicy | null,
  allowance: Allowance | null,
): boolean {
  return (
    !!policy &&
    policy.maxUnits !== null &&
    !!allowance &&
    policy.unitsPerSet > 0 &&
    allowance.count > Math.floor(policy.maxUnits / policy.unitsPerSet)
  );
}

import type { TopGearReport, TopGearRequest } from "@/domain/top-gear/model";

export function requestFromReport(report: TopGearReport): TopGearRequest {
  return {
    tool: "top-gear",
    precision: "standard",
    snapshot: report.purchases?.originalSnapshot ?? report.snapshot,
    selection: report.selection,
    ...(report.purchases ? { purchases: report.purchases.inputs } : {}),
  };
}

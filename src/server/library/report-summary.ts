import type { LibrarySummary } from "@/domain/accounts/contracts";
import type { TopGearReport } from "@/domain/top-gear/model";
import { getSpec } from "@/features/settings/registry";

function boundedText(value: unknown, maximum: number, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum)
    throw new Error(`Invalid ${label}`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

export function summarizeReport(report: TopGearReport): LibrarySummary {
  if (!report.rows.length) throw new Error("Report has no successful results");
  const spec = getSpec(boundedText(report.snapshot.specId, 120, "spec"));
  const selected =
    report.rows.find((row) => row.id === report.recommendedId) ??
    report.rows.find((row) => row.id === report.highestId);
  if (!selected) throw new Error("Report has no recommended or highest result");
  const equipped = report.rows.find((row) => row.id === report.equippedId);
  const dps = finite(selected.dps, "DPS");
  const equippedDps = equipped ? finite(equipped.dps, "equipped DPS") : null;
  const gainDps =
    equippedDps === null ? null : finite(dps - equippedDps, "DPS gain");
  const player = report.snapshot.settings.player;
  // Admission and historical frozen reports permit empty names. This fallback
  // belongs only to library display metadata; never rewrite the report snapshot.
  const characterName =
    boundedText(
      player?.name === "" ? "Unnamed character" : player?.name,
      80,
      "character name",
    ).trim() || "Unnamed character";

  return {
    characterName,
    classKey: boundedText(spec.className.toLowerCase(), 80, "class key"),
    specKey: boundedText(spec.id, 120, "spec key"),
    level: 80,
    dps,
    gainDps,
  };
}

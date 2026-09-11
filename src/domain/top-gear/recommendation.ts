import { characterStats } from "@/domain/equipment/character-stats";
import type { SetRow, Snapshot } from "./model";

/** Only recommend measured, eligible builds tied with the best that meet every applicable cap. */
export function recommendedBuild(
  snapshot: Snapshot,
  rows: SetRow[],
): string | null {
  const candidates = rows
    .filter(
      (row) =>
        row.eligible && row.tiedToHighest === true && Number.isFinite(row.dps),
    )
    .sort(
      (a, b) => b.dps - a.dps || a.swaps - b.swaps || a.id.localeCompare(b.id),
    );

  for (const row of candidates) {
    if (!row.stats?.length) continue;
    const { accuracy } = characterStats(row, snapshot);
    if (
      accuracy.length > 0 &&
      accuracy.every(
        (cap) => Number.isFinite(row.stats?.[cap.stat]) && cap.capped,
      )
    )
      return row.id;
  }
  return null;
}

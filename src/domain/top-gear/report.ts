import type {
  Metric,
  Snapshot,
  Loadout,
  SimulationResult,
  SetRow,
  GemOverrides,
  EnchantOverrides,
} from "./model";
import { withEnhancements } from "@/domain/equipment/enhancements";
import { slots } from "./slots";
import { recommendedBuild } from "./recommendation";
import {
  loadoutKey,
  itemKey,
  alignPairedSlots,
} from "@/domain/equipment/enumerate";
export function compareMetrics(a: Metric, b: Metric) {
  for (const m of [a, b])
    if (
      !Number.isFinite(m.mean) ||
      !Number.isInteger(m.iterations) ||
      m.iterations < 1 ||
      (m.stdev !== null && (!Number.isFinite(m.stdev) || m.stdev < 0))
    )
      throw new Error("Invalid simulation metric");
  const gain = a.mean - b.mean;
  const se =
    a.stdev !== null && b.stdev !== null && a.iterations > 1 && b.iterations > 1
      ? Math.sqrt(a.stdev ** 2 / a.iterations + b.stdev ** 2 / b.iterations)
      : null;
  return {
    gain,
    percent: b.mean === 0 ? null : (100 * gain) / b.mean,
    tied: se === null ? null : Math.abs(gain) <= 1.96 * se,
  };
}
export function changedSlots(snapshot: Snapshot, a: Loadout, b: Loadout) {
  const aligned = alignPairedSlots(snapshot, b, a);
  return slots.filter(
    (slot) => itemKey(snapshot, a[slot]) !== itemKey(snapshot, aligned[slot]),
  );
}
export function changedResultSlots(
  snapshot: Snapshot,
  a: Loadout,
  b: Loadout,
  aGems: GemOverrides = {},
  bGems: GemOverrides = {},
  aEnchants: EnchantOverrides = {},
  bEnchants: EnchantOverrides = {},
) {
  const aligned = alignPairedSlots(snapshot, b, a);
  const from = withEnhancements(snapshot, aGems, aEnchants),
    to = withEnhancements(snapshot, bGems, bEnchants);
  return slots.filter(
    (slot) => itemKey(from, a[slot]) !== itemKey(to, aligned[slot]),
  );
}
export function rankResults(
  snapshot: Snapshot,
  results: SimulationResult[],
  candidates: Loadout[],
) {
  // Older reports can contain multiple noisy simulations of the same pair.
  // Choose by reference placement and hash, never by whichever DPS was luckiest.
  const placementChanges = (r: SimulationResult) =>
    slots.filter(
      (slot) =>
        itemKey(snapshot, r.loadout[slot]) !==
        itemKey(snapshot, snapshot.equipped[slot]),
    ).length;
  const resultKey = (r: SimulationResult) =>
    loadoutKey(snapshot, r.loadout, r.isReference === true);
  const unique = new Map<string, SimulationResult>();
  for (const r of [...results].sort(
    (a, b) =>
      placementChanges(a) - placementChanges(b) ||
      a.inputHash.localeCompare(b.inputHash),
  )) {
    const key = resultKey(r);
    if (!unique.has(key)) unique.set(key, r);
  }
  results = [...unique.values()];
  const eligible = new Set(candidates.map((c) => loadoutKey(snapshot, c))),
    equippedKey = loadoutKey(snapshot, snapshot.equipped, true),
    baseline = results.find((r) => resultKey(r) === equippedKey);
  const ordered = [...results].sort(
    (a, b) =>
      b.metric.mean - a.metric.mean || resultKey(a).localeCompare(resultKey(b)),
  );
  const highest = ordered.find((r) => eligible.has(resultKey(r)));
  const rows: SetRow[] = ordered.map((r) => {
    const key = resultKey(r),
      isEquipped = key === equippedKey;
    const delta = baseline ? compareMetrics(r.metric, baseline.metric) : null;
    return {
      id: r.inputHash,
      loadout: alignPairedSlots(snapshot, r.loadout),
      ...(r.enchantOverrides
        ? {
            enchantOverrides: r.enchantOverrides,
            enchantWarnings: r.enchantWarnings,
          }
        : {}),
      ...(r.gemOverrides
        ? { gemOverrides: r.gemOverrides, gemWarnings: r.gemWarnings }
        : {}),
      dps: r.metric.mean,
      gain: isEquipped ? 0 : (delta?.gain ?? null),
      percent:
        isEquipped && baseline?.metric.mean ? 0 : (delta?.percent ?? null),
      swaps: changedSlots(snapshot, snapshot.equipped, r.loadout).length,
      eligible: eligible.has(key),
      isEquipped,
      tiedToHighest: highest
        ? r === highest
          ? true
          : compareMetrics(r.metric, highest.metric).tied
        : null,
      iterations: r.metric.iterations,
      inputHash: r.inputHash,
      stats: r.stats,
      stdev: r.metric.stdev,
    };
  });
  return {
    rows,
    equippedId: baseline?.inputHash ?? "",
    highestId: highest?.inputHash ?? null,
    recommendedId: recommendedBuild(snapshot, rows),
  };
}

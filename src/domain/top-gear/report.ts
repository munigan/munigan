import type {
  Metric,
  Snapshot,
  Loadout,
  SimulationResult,
  SetRow,
} from "./model";
import { slots } from "./slots";
import { loadoutKey } from "@/domain/equipment/enumerate";
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
  return slots.filter((slot) => {
    const x = { ...a },
      y = { ...a };
    x[slot] = a[slot];
    y[slot] = b[slot];
    return loadoutKey(snapshot, x) !== loadoutKey(snapshot, y);
  });
}
export function rankResults(
  snapshot: Snapshot,
  results: SimulationResult[],
  candidates: Loadout[],
) {
  const eligible = new Set(candidates.map((c) => loadoutKey(snapshot, c))),
    equippedKey = loadoutKey(snapshot, snapshot.equipped),
    baseline = results.find(
      (r) => loadoutKey(snapshot, r.loadout) === equippedKey,
    );
  const ordered = [...results].sort(
    (a, b) =>
      b.metric.mean - a.metric.mean ||
      loadoutKey(snapshot, a.loadout).localeCompare(
        loadoutKey(snapshot, b.loadout),
      ),
  );
  const highest = ordered.find((r) =>
    eligible.has(loadoutKey(snapshot, r.loadout)),
  );
  const rows: SetRow[] = ordered.map((r) => {
    const key = loadoutKey(snapshot, r.loadout),
      isEquipped = key === equippedKey;
    const delta = baseline ? compareMetrics(r.metric, baseline.metric) : null;
    return {
      id: r.inputHash,
      loadout: r.loadout,
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
  const recommended = rows
    .filter((r) => r.eligible && r.tiedToHighest === true)
    .sort(
      (a, b) => a.swaps - b.swaps || b.dps - a.dps || a.id.localeCompare(b.id),
    )[0];
  return {
    rows,
    equippedId: baseline?.inputHash ?? "",
    highestId: highest?.inputHash ?? null,
    recommendedId: recommended?.id ?? highest?.inputHash ?? null,
  };
}

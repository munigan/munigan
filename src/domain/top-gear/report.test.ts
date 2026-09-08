import { it, expect } from "vitest";
import { rankResults, compareMetrics } from "./report";
import { emptyLoadout } from "./slots";
import type { Snapshot, SimulationResult } from "./model";
const equipped = { ...emptyLoadout(), head: "a", chest: "b" };
const snapshot = {
  equipped,
  inventory: [
    { instanceId: "a", itemId: 1, enchantId: 0, gemIds: [] },
    { instanceId: "b", itemId: 2, enchantId: 0, gemIds: [] },
    { instanceId: "x", itemId: 3, enchantId: 0, gemIds: [] },
    { instanceId: "y", itemId: 4, enchantId: 0, gemIds: [] },
  ],
} as unknown as Snapshot;
const row = (
  loadout: typeof equipped,
  mean: number,
  stdev: number | null = 100,
): SimulationResult => ({
  loadout,
  metric: { mean, stdev, iterations: 5000 },
  inputHash: String(mean),
  stats: [],
});
it("retains interacting combinations and negative gains against the equipped reference", () => {
  const values = [
    row(equipped, 10000),
    row({ ...equipped, head: "x" }, 9990),
    row({ ...equipped, chest: "y" }, 9980),
    row({ ...equipped, head: "x", chest: "y" }, 10200),
  ];
  const r = rankResults(
    snapshot,
    values,
    values.slice(1).map((v) => v.loadout),
  );
  expect(r.rows.map((x) => x.dps)).toEqual([10200, 10000, 9990, 9980]);
  expect(r.rows[0].gain).toBe(200);
  expect(r.rows[1].eligible).toBe(false);
  expect(r.rows[3].gain).toBe(-20);
  expect(r.highestId).toBe(r.rows[0].id);
});
it("recommends fewer swaps within uncertainty without changing numeric ordering", () => {
  const values = [
    row(equipped, 10000),
    row({ ...equipped, head: "x", chest: "y" }, 10200, 200),
    row({ ...equipped, head: "x" }, 10196, 200),
  ];
  const r = rankResults(
    snapshot,
    values,
    values.map((v) => v.loadout),
  );
  expect(r.highestId).toBe(r.rows[0].id);
  expect(r.recommendedId).toBe(r.rows[1].id);
  expect(r.rows[0].swaps).toBe(2);
});
it("does not invent uncertainty or percentages for a zero baseline", () => {
  expect(
    compareMetrics(
      { mean: 1, stdev: null, iterations: 5 },
      { mean: 0, stdev: 0, iterations: 5 },
    ),
  ).toEqual({ gain: 1, percent: null, tied: null });
});

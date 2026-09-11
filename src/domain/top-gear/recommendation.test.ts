import { describe, expect, it } from "vitest";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import { Race, Stat } from "@/generated/wotlk/common";
import { ratingConversions as r } from "@/domain/equipment/character-stats";
import { emptyLoadout } from "./slots";
import type { SetRow, Snapshot } from "./model";
import { recommendedBuild } from "./recommendation";

function snapshot(module = "warrior") {
  const spec = listSpecs().find((spec) => spec.module === module)!;
  const settings = defaultSettings(spec.id);
  settings.player!.race = Race.RaceTroll;
  settings.player!.inFrontOfTarget = false;
  return {
    specId: spec.id,
    settings,
    inventory: [],
    equipped: emptyLoadout(),
  } as unknown as Snapshot;
}

function build(id: string, overrides: Partial<SetRow> = {}): SetRow {
  const stats = Array(40).fill(0);
  stats[Stat.StatMeleeHit] = 8 * r.meleeHit;
  stats[Stat.StatExpertise] = 26 * r.expertise;
  return {
    id,
    inputHash: id,
    loadout: emptyLoadout(),
    stats,
    dps: 10000,
    gain: 0,
    percent: 0,
    swaps: 1,
    eligible: true,
    isEquipped: false,
    tiedToHighest: true,
    iterations: 5000,
    ...overrides,
  };
}

describe("cap-aware build recommendations", () => {
  it("chooses the highest DPS capped tie, without reordering rows", () => {
    const top = build("top", { dps: 10010 });
    top.stats![Stat.StatExpertise] -= 1;
    const best = build("capped", { dps: 10005, swaps: 3 });
    const fewerSwaps = build("fewer-swaps", { dps: 10001, swaps: 1 });
    const rows = [top, fewerSwaps, best];
    expect(recommendedBuild(snapshot(), rows)).toBe("capped");
    expect(rows.map((row) => row.id)).toEqual(["top", "fewer-swaps", "capped"]);
  });

  it("requires both hit and expertise and never recommends a non-tie or reference-only build", () => {
    const missingHit = build("missing-hit");
    missingHit.stats![Stat.StatMeleeHit] -= 1;
    expect(
      recommendedBuild(snapshot(), [
        missingHit,
        build("not-tied", { tiedToHighest: false }),
        build("unknown-tie", { tiedToHighest: null }),
        build("reference", { eligible: false }),
      ]),
    ).toBeNull();
  });

  it("does not infer caps from missing or non-finite stats", () => {
    const invalid = build("invalid");
    invalid.stats![Stat.StatExpertise] = NaN;
    const incomplete = build("incomplete", { stats: [100] });
    expect(
      recommendedBuild(snapshot(), [
        invalid,
        incomplete,
        build("missing", { stats: [] }),
      ]),
    ).toBeNull();
  });

  it("can recommend the highest result or equipped set when eligible and capped", () => {
    const top = build("top", { dps: 10010 });
    expect(recommendedBuild(snapshot(), [build("other"), top])).toBe("top");
    expect(
      recommendedBuild(snapshot(), [build("equipped", { isEquipped: true })]),
    ).toBe("equipped");
  });

  it("uses spell hit for casters and ranged hit without expertise for hunters", () => {
    const caster = build("caster");
    caster.stats![Stat.StatMeleeHit] = 0;
    caster.stats![Stat.StatExpertise] = 0;
    caster.stats![Stat.StatSpellHit] = 17 * r.spellHit;
    expect(recommendedBuild(snapshot("mage"), [caster])).toBe("caster");
    const hunter = build("hunter");
    hunter.stats![Stat.StatExpertise] = 0;
    expect(recommendedBuild(snapshot("hunter"), [hunter])).toBe("hunter");
  });

  it("also requires spell hit for hybrid melee specs", () => {
    const hybrid = build("hybrid");
    expect(recommendedBuild(snapshot("deathknight"), [hybrid])).toBeNull();
    hybrid.stats![Stat.StatSpellHit] = 17 * r.spellHit;
    expect(recommendedBuild(snapshot("deathknight"), [hybrid])).toBe("hybrid");
  });
});

import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en-US/reports.json";
import pt from "../../../messages/pt-BR/reports.json";
import { Stat } from "@/generated/wotlk/common";
import type { SetRow, Snapshot } from "@/domain/top-gear/model";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import {
  characterStats,
  combinationStats,
  type StatCap,
} from "./character-stats";
import {
  localizedCapDifference,
  presentCombinationStat,
  reportPercentage,
} from "./stat-presentation";
const english = createTranslator({
  locale: "en-US",
  messages: en,
});
const portuguese = createTranslator({
  locale: "pt-BR",
  messages: pt,
});

describe("localized stat presentation", () => {
  it.each([
    [0, true, "At cap", "No limite"],
    [-0.0000001, true, "At cap", "No limite"],
    [-0.001, false, "1 rating below cap", "1 de índice abaixo do limite"],
    [-32.1, false, "33 rating below cap", "33 de índice abaixo do limite"],
    [0.5, true, "<1 rating above cap", "<1 de índice acima do limite"],
    [32.1, true, "32 rating above cap", "32 de índice acima do limite"],
  ])(
    "preserves cap boundary rounding for %s",
    (difference, capped, expectedEn, expectedPt) => {
      const cap = { difference, capped } as StatCap;
      expect(localizedCapDifference(cap, english, "en-US")).toBe(expectedEn);
      expect(localizedCapDifference(cap, portuguese, "pt-BR")).toBe(expectedPt);
    },
  );
  it("formats percentage points without multiplying them by 100", () => {
    expect(reportPercentage(8.25, "en-US")).toBe("8.25%");
    expect(reportPercentage(8.25, "pt-BR")).toBe("8,25%");
  });
  it("renders each supported spec without mutating stats, cap calculations or the request", () => {
    for (const spec of listSpecs()) {
      const snapshot = {
        specId: spec.id,
        settings: defaultSettings(spec.id),
        inventory: [],
        equipped: {},
      } as unknown as Snapshot;
      const row = { stats: Array(40).fill(100), loadout: {} } as SetRow;
      const before = JSON.stringify({ snapshot, row });
      const caps = characterStats(row, snapshot);
      const stats = combinationStats(row, snapshot);
      const original = structuredClone({ caps, stats });
      for (const [t, locale] of [
        [english, "en-US"],
        [portuguese, "pt-BR"],
      ] as const) {
        for (const stat of stats) {
          const presented = presentCombinationStat(stat, t, locale);
          expect(presented.label).toBeTruthy();
          expect(presented.description).not.toMatch(
            /^(labels|context|bonus)\./,
          );
        }
      }
      expect({ caps, stats }).toEqual(original);
      expect(JSON.stringify({ snapshot, row })).toBe(before);
      expect(characterStats(row, snapshot)).toEqual(caps);
    }
  });
  it("uses semantic descriptors instead of legacy English prose", () => {
    const cap = {
      stat: Stat.StatExpertise,
      difference: 0,
      capped: true,
      effective: 26,
      presentation: {
        label: "expertise-mh",
        context: "behind",
        bonuses: [{ kind: "vengeance", amount: 10 }],
      },
    } as StatCap;
    const value = presentCombinationStat(
      {
        id: "expertise-mh",
        label: "untrusted legacy label",
        percent: 6.5,
        description: "legacy prose",
        presentation: { kind: "cap", cap },
      },
      portuguese,
      "pt-BR",
    );
    expect(value.label).toBe("Apt. · MP");
    expect(value.description).toContain("26,00 de aptidão");
    expect(value.description).toContain("Seal of Vengeance");
    expect(value.description).not.toContain("legacy");
  });
});

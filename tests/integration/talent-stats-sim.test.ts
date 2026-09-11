import { expect, it } from "vitest";
import { resolve } from "node:path";
import { modules, listSpecs } from "@/features/settings/registry";
import { parseExport, resolveSnapshot } from "@/features/import/parse-export";
import { simulationInput } from "@/server/simulator/evaluate";
import { runCli } from "@/server/simulator/cli";
import {
  characterStats,
  ratingConversions as r,
} from "@/domain/equipment/character-stats";
import type { Snapshot, SetRow } from "@/domain/top-gear/model";
import { Stat } from "@/generated/wotlk/common";
import trees from "../../data/wotlk/talent-trees.json";

const normalize = (name: string) => name.replace(/[^a-z]/gi, "").toLowerCase();
const conversions: Partial<Record<Stat, number>> = {
  [Stat.StatExpertise]: r.expertise,
  [Stat.StatMeleeHit]: r.meleeHit,
  [Stat.StatSpellHit]: r.spellHit,
  [Stat.StatArmorPenetration]: r.armorPenetration,
  [Stat.StatMeleeCrit]: r.crit,
  [Stat.StatSpellCrit]: r.crit,
  [Stat.StatSpellHaste]: r.haste,
};
async function measure(snapshot: Snapshot) {
  const result = await runCli(
    simulationInput(snapshot, snapshot.equipped, 1, "1"),
    {
      binary:
        process.env.SIM_BINARY ?? resolve("dist/simulator/local/wowsimcli"),
      signal: new AbortController().signal,
      maxSeconds: 30,
      statsOnly: true,
      itemVersion: snapshot.itemVersion,
    },
  );
  return result.statsResult.raidStats!.parties[0].players[0].finalStats!.stats;
}

it.each(listSpecs().map((spec) => [spec.id, spec] as const))(
  "matches each named contribution against native stats for %s",
  async (_id, spec) => {
    const variant =
      modules[spec.module].variants.find(
        (v) => v.talents.talentsString === spec.talents.talentsString,
      ) ?? modules[spec.module].variants[0];
    const gear = Object.values(variant.defaultGear["1"]).at(-1);
    const { snapshot } = resolveSnapshot(
      parseExport(
        JSON.stringify({
          name: "Talent stat check",
          class: spec.classId,
          race: spec.race,
          level: 80,
          talents: spec.talents.talentsString,
          gear,
        }),
        "character",
      ),
      spec.id,
    );
    snapshot.itemVersion = "classic";
    const stats = await measure(snapshot);
    const row = { stats, loadout: snapshot.equipped } as SetRow;
    const bonuses = characterStats(row, snapshot).talentBonuses;
    const classTrees = (
      trees as Record<string, { talents: { fieldName?: string }[] }[]>
    )[String(spec.classId)];
    for (const name of new Set(bonuses.map((b) => b.talent))) {
      const without = structuredClone(snapshot);
      const strings = without.settings.player!.talentsString.split("-");
      let found = false;
      classTrees.forEach((tree, t) =>
        tree.talents.forEach((talent, i) => {
          if (normalize(talent.fieldName ?? "") !== normalize(name)) return;
          const ranks = [...strings[t]];
          ranks[i] = "0";
          strings[t] = ranks.join("");
          found = true;
        }),
      );
      expect(found, name).toBe(true);
      without.settings.player!.talentsString = strings.join("-");
      const off = await measure(without);
      for (const bonus of bonuses.filter((b) => b.talent === name)) {
        const conversion =
          bonus.unit === "rating" ? 1 : conversions[bonus.stat]!;
        expect(
          (stats[bonus.stat] - off[bonus.stat]) / conversion,
          `${name}: ${Stat[bonus.stat]}`,
        ).toBeCloseTo(bonus.amount, 5);
      }
    }
  },
);

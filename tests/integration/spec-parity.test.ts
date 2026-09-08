import { it, expect } from "vitest";
import {
  listSpecs,
  modules,
  defaultSettings,
} from "@/features/settings/registry";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import { parseExport, resolveSnapshot } from "@/features/import/parse-export";
import { evaluate } from "@/server/simulator/evaluate";
for (const spec of listSpecs())
  it(`native preset: ${spec.className} / ${spec.module} / ${spec.name}`, async () => {
    const settings = defaultSettings(spec.id);
    const points = spec.talents.talentsString
      .split("-")
      .map((t) => [...t].reduce((s, n) => s + Number(n), 0));
    const tree = points.indexOf(Math.max(...points));
    const gear = Object.values(modules[spec.module].presets).find(
      (p) =>
        p.gear &&
        (p.conditions?.talentTree === undefined ||
          p.conditions.talentTree === tree) &&
        (!p.conditions?.talentTrees || p.conditions.talentTrees.includes(tree)),
    )!.gear;
    settings.player!.equipment = gear as NonNullable<
      typeof settings.player
    >["equipment"];
    settings.player!.profession1 = 4;
    settings.player!.profession2 = 7;
    settings.encounter!.duration = 30;
    settings.encounter!.durationVariation = 0;
    const { snapshot } = resolveSnapshot(
      parseExport(IndividualSimSettings.toJsonString(settings), "profile"),
      spec.id,
    );
    const result = await evaluate(
      snapshot,
      snapshot.equipped,
      10,
      "101001",
      new AbortController().signal,
    );
    expect(result.metric.mean).toBeGreaterThan(100);
    expect(result.metric.stdev).toBeGreaterThanOrEqual(0);
  }, 30000);

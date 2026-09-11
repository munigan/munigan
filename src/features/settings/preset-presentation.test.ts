import { describe, expect, it } from "vitest";
import { getSpec, listSpecs } from "./registry";
import { presetPresentation } from "./preset-presentation";
import trees from "../../../data/wotlk/talent-trees.json";
import english from "../../../messages/en-US/settings.json";
import portuguese from "../../../messages/pt-BR/settings.json";

describe("preset presentation", () => {
  it("counts points from the talent string in tree order, including empty trees", () => {
    expect(presetPresentation(getSpec("deathknight:FrostTalents")).points).toBe(
      "15/56/0",
    );
    expect(
      presetPresentation(getSpec("deathknight:FrostUnholyTalents")).points,
    ).toBe("1/52/18");
    expect(
      presetPresentation(getSpec("balance_druid:Phase1Talents")).points,
    ).toBe("58/0/13");
    const changed = structuredClone(getSpec("mage:FrostTalents"));
    changed.talents.talentsString = "-12";
    expect(presetPresentation(changed).points).toBe("0/3/0");
  });

  it("covers every shipped preset with distinct, translated labels and the correct tree order", () => {
    const catalog = trees as Record<string, Array<{ name: string }>>;
    for (const messages of [english, portuguese]) {
      const options = messages.presets.options as Record<
        string,
        { name: string; description: string }
      >;
      const labels = new Set<string>();
      for (const spec of listSpecs()) {
        const detail = presetPresentation(spec);
        expect(detail.key, spec.id).toBeTruthy();
        const copy = options[detail.key!];
        expect(copy?.name, spec.id).toBeTruthy();
        expect(copy?.description, spec.id).toBeTruthy();
        expect(detail.icon, spec.id).not.toBe("inv_misc_questionmark");
        expect(detail.treeNames, spec.id).toEqual(
          catalog[String(spec.classId)].map((tree) => tree.name),
        );
        expect(
          detail.points
            .split("/")
            .map(Number)
            .reduce((sum, value) => sum + value, 0),
          spec.id,
        ).toBe(71);
        const label = `${spec.classId}:${copy.name} (${detail.points})`;
        expect(labels.has(label), label).toBe(false);
        labels.add(label);
      }
    }
  });
});

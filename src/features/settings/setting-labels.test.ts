import { expect, it } from "vitest";
import {
  RaidBuffs,
  PartyBuffs,
  IndividualBuffs,
  Debuffs,
  Consumes,
} from "@/generated/wotlk/common";
import metadata from "../../../data/wotlk/settings-ui.json";
import en from "../../../messages/en-US/settings.json";
import pt from "../../../messages/pt-BR/settings.json";
import {
  buffLabelKeys,
  buffProperNames,
  consumeFallbackNames,
} from "./setting-labels";

it("classifies every rendered buff field as a proper name or translated UI copy", () => {
  for (const [group, type] of Object.entries({
    raidBuffs: RaidBuffs,
    partyBuffs: PartyBuffs,
    buffs: IndividualBuffs,
    debuffs: Debuffs,
  })) {
    for (const field of type.fields) {
      const id = `${group}.${field.localName}`;
      expect(
        Boolean(buffLabelKeys[id]) !== Boolean(buffProperNames[id]),
        id,
      ).toBe(true);
    }
  }
  for (const key of Object.values(buffLabelKeys)) {
    const resolve = (messages: object) =>
      key
        .split(".")
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)[part],
          messages,
        );
    expect(resolve(en), key).toBeTypeOf("string");
    expect(resolve(pt), key).toBeTypeOf("string");
    expect(resolve(en), key).not.toBe(resolve(pt));
  }
});

it("has an explicit English item name for every consumable enum choice", () => {
  const consumes = metadata.consumes as Record<
    string,
    Record<string, { name: string }>
  >;
  for (const field of Consumes.fields) {
    if (field.kind !== "enum") continue;
    const enumeration = field.T();
    for (const value of Object.values(enumeration[1])) {
      if (typeof value !== "number" || !value) continue;
      expect(
        consumes[enumeration[0].replace("proto.", "")]?.[value]?.name ??
          consumeFallbackNames[`${enumeration[0]}.${value}`],
        `${enumeration[0]}.${value}`,
      ).toBeTruthy();
    }
  }
});

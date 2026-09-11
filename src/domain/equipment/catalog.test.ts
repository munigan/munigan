import { expect, it } from "vitest";
import { getCatalog } from "./catalog";

it("resolves icons for item enchants, engineering tinkers, and weapon runes", () => {
  const catalog = getCatalog("original");
  expect(catalog.enchants.get(3817)?.[0].icon).toBe("ability_warrior_rampage");
  expect(catalog.enchants.get(3604)?.[0].icon).toBe("trade_engineering");
  expect(catalog.enchants.get(3370)?.[0].icon).toBe("spell_frost_frostarmor");
  expect(catalog.enchants.get(3368)?.[0].icon).toBe(
    "spell_holy_retributionaura",
  );
  expect(catalog.enchants.get(3855)?.[0].icon).toBe("spell_holy_greaterheal");
  expect(catalog.enchants.get(3823)?.[0].icon).toBe("trade_leatherworking");
});

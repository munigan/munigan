import { it, expect } from "vitest";
import { encodeRequest, validateRequest } from "./request-schema";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { Profession } from "@/generated/wotlk/common";

it("accepts crafting professions below 450 without changing their imported ranks", () => {
  const request = fixtureRequest();
  request.snapshot.professionLevels = {
    [Profession.Engineering]: 425,
    [Profession.Jewelcrafting]: 400,
  };
  const admitted = validateRequest(encodeRequest(request));
  expect(admitted.snapshot.professionLevels).toEqual(
    request.snapshot.professionLevels,
  );
  expect(admitted.snapshot.settings.player?.profession1).toBe(
    Profession.Engineering,
  );
  expect(admitted.snapshot.inventory).toEqual(request.snapshot.inventory);
});

it("identifies a gathering bonus that still depends on maximum skill", () => {
  const request = fixtureRequest();
  request.snapshot.settings.player!.profession2 = Profession.Skinning;
  request.snapshot.professionLevels = { [Profession.Skinning]: 375 };
  expect(() => validateRequest(encodeRequest(request))).toThrow(
    /Skinning.*40 critical strike/i,
  );
});
it("round trips protobuf settings and rejects forged inventory references", () => {
  const r = fixtureRequest();
  expect(validateRequest(encodeRequest(r)).snapshot.equipped).toEqual(
    r.snapshot.equipped,
  );
  const forged = encodeRequest(r);
  forged.selection.selectedInstanceIds.push("not-owned");
  expect(() => validateRequest(forged)).toThrow(/owned|instance/);
});
it("requires unsupported bag exclusions and blocks a custom mechanics database", () => {
  const r = fixtureRequest();
  r.snapshot.inventory.push({
    instanceId: "junk",
    itemId: 9999999,
    enchantId: 0,
    gemIds: [],
    source: "bag",
  });
  expect(() => validateRequest(encodeRequest(r))).toThrow(/exclu/i);
  r.selection.acknowledgedExclusions = ["junk"];
  expect(() => validateRequest(encodeRequest(r))).not.toThrow();
  r.snapshot.settings.player!.database = { items: [], enchants: [], gems: [] };
  expect(() => validateRequest(encodeRequest(r))).toThrow(/database/i);
});

import { it, expect } from "vitest";
import { encodeRequest, validateRequest } from "./request-schema";
import { fixtureRequest } from "../../../tests/support/fixtures";
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

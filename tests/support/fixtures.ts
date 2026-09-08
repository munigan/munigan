import fixture from "../fixtures/sim/warrior.request.json";
import { parseExport, resolveSnapshot } from "@/features/import/parse-export";
import { listSpecs } from "@/features/settings/registry";
import type { TopGearRequest } from "@/domain/top-gear/model";
export function fixtureRequest(): TopGearRequest {
  const player = {
    ...fixture.raid.parties[0].players[0],
    profession1: 4,
    profession2: 7,
  };
  const { snapshot } = resolveSnapshot(
    parseExport(
      JSON.stringify({ player, encounter: fixture.encounter }),
      "profile",
    ),
    listSpecs().find((s) => s.name === "Fury")!.id,
  );
  return {
    tool: "top-gear",
    precision: "standard",
    snapshot,
    selection: {
      selectedInstanceIds: snapshot.inventory.map((i) => i.instanceId),
      lockedSlots: {},
      acknowledgedExclusions: [],
    },
  };
}

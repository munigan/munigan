import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { RaidSimRequest, Player } from "@/generated/wotlk/api";
import { APLRotation, APLRotation_Type } from "@/generated/wotlk/apl";
import type {
  Snapshot,
  Loadout,
  SimulationResult,
} from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import { getSpec } from "@/features/settings/registry";
import { readTalents, talentPoints } from "@/features/settings/talents";
import { getCatalog } from "@/domain/equipment/catalog";
import { autoRotations } from "@/generated/wotlk/auto-rotations";
import { runCli } from "./cli";
import { itemVersionOf, itemVersions } from "@/domain/top-gear/item-version";
import { prepareGems, inactiveMetaIds } from "@/domain/equipment/gemming";
import {
  prepareEnchants,
  withEnhancements,
} from "@/domain/equipment/enhancements";
export function simulationInput(
  snapshot: Snapshot,
  loadout: Loadout,
  iterations: number,
  seed: string,
  reference = false,
) {
  if (reference) snapshot = { ...snapshot, itemEnhancements: undefined };
  const s = snapshot.settings;
  if (!s.player || !s.encounter)
    throw new Error("Missing simulation configuration");
  const player = Player.clone(s.player);
  const resolved = withEnhancements(
    snapshot,
    prepareGems(snapshot, loadout).overrides,
    prepareEnchants(snapshot, loadout).overrides,
  );
  const inventory = new Map(resolved.inventory.map((i) => [i.instanceId, i]));
  // The native engine applies meta effects unconditionally; its browser UI
  // removes inactive metas before submitting. Apply the same legality to the
  // reference and candidates, independently of automatic preparation settings.
  const inactive = inactiveMetaIds(resolved, loadout);
  player.equipment = {
    items: slots.map((slot) => {
      const i = inventory.get(loadout[slot] ?? "");
      return {
        id: i?.itemId ?? 0,
        enchant: i?.enchantId ?? 0,
        gems: i?.gemIds.map((id) => (inactive.has(id) ? 0 : id)) ?? [],
      };
    }),
  };
  player.database = undefined;
  player.enableItemSwap = false;
  player.itemSwap = undefined;
  return RaidSimRequest.create({
    raid: {
      parties: [{ players: [player], buffs: s.partyBuffs }],
      buffs: s.raidBuffs,
      debuffs: s.debuffs,
      tanks: s.tanks,
    },
    encounter: s.encounter,
    simOptions: { iterations, randomSeed: BigInt(seed) },
  });
}
export async function evaluate(
  snapshot: Snapshot,
  loadout: Loadout,
  iterations: number,
  seed: string,
  signal: AbortSignal,
  reference = false,
): Promise<SimulationResult> {
  if (reference) snapshot = { ...snapshot, itemEnhancements: undefined };
  const input = simulationInput(snapshot, loadout, iterations, seed),
    player = input.raid!.parties[0].players[0];
  const options = {
    itemVersion: itemVersionOf(snapshot),
    binary:
      process.env.SIM_BINARY ??
      resolve(
        existsSync("dist/simulator/local/wowsimcli")
          ? "dist/simulator/local/wowsimcli"
          : "dist/simulator/wowsimcli",
      ),
    signal,
    maxSeconds: Number(process.env.SIM_TIMEOUT_SECONDS ?? 60),
  };
  if (
    player.rotation?.type === APLRotation_Type.TypeSimple ||
    player.rotation?.type === APLRotation_Type.TypeLegacy
  )
    throw new Error(
      "Use Automatic or APL rotation in the simulator before exporting",
    );
  if (!player.rotation || player.rotation.type !== APLRotation_Type.TypeAPL) {
    const spec = getSpec(snapshot.specId),
      points = talentPoints(snapshot);
    let sets: string[] = [];
    if (spec.module === "enhancement_shaman") {
      const computed = await runCli(input, { ...options, statsOnly: true });
      sets = computed.statsResult.raidStats!.parties[0].players[0].sets;
    }
    const playerJson = player.spec as unknown as Record<string, unknown>;
    const specOptions =
      (playerJson[player.spec.oneofKind ?? ""] as { options?: unknown })
        ?.options ?? {};
    const facade = {
      getTalentTree: () => points.indexOf(Math.max(...points)),
      getTalentTreePoints: () => points,
      getTalents: () => readTalents(snapshot),
      getSpecOptions: () => specOptions,
      getCurrentStats: () => ({ sets }),
      getEquippedItem: (slot: number) => ({
        item: getCatalog(snapshot.itemVersion).items.get(
          player.equipment!.items[slot].id,
        ) ?? {
          handType: 0,
        },
      }),
      sim: { encounter: { targets: input.encounter!.targets } },
    };
    player.rotation = APLRotation.create(
      autoRotations[spec.module as keyof typeof autoRotations](facade),
    );
  }
  const result = await runCli(input, options),
    metric = result.raidResult.raidMetrics!.parties[0].players[0].dps!;
  const gemPlan = prepareGems(snapshot, loadout);
  const enchantPlan = prepareEnchants(snapshot, loadout);
  const inactive = inactiveMetaIds(snapshot, loadout, gemPlan.overrides);
  return {
    loadout,
    isReference: reference,
    ...(snapshot.autoEnchant || Object.keys(enchantPlan.overrides).length
      ? {
          enchantOverrides: enchantPlan.overrides,
          enchantWarnings: enchantPlan.warnings,
        }
      : {}),
    ...(snapshot.gemming?.enabled ||
    Object.keys(gemPlan.overrides).length ||
    inactive.size
      ? {
          gemOverrides: gemPlan.overrides,
          gemWarnings: [
            ...gemPlan.warnings,
            ...[...inactive].map(
              (id) =>
                `${getCatalog(snapshot.itemVersion).gems.get(id)?.name ?? id} is inactive; its stats and effect are excluded from this simulation.`,
            ),
          ],
        }
      : {}),
    inputHash: createHash("sha256")
      .update(
        `${options.itemVersion}:${snapshot.itemDataRevision ?? itemVersions[options.itemVersion].revision}:`,
      )
      .update(RaidSimRequest.toJsonString(input))
      .digest("hex"),
    metric: { mean: metric.avg, stdev: metric.stdev, iterations },
    stats:
      result.statsResult.raidStats!.parties[0].players[0].finalStats!.stats,
  };
}

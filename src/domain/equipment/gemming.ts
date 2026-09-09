import type {
  GemmingSettings,
  GemOverrides,
  ItemInstance,
  Loadout,
  Snapshot,
} from "@/domain/top-gear/model";
import { GemColor, Profession } from "@/generated/wotlk/common";
import type { UIGem } from "@/generated/wotlk/ui";
import { getCatalog, type Catalog } from "./catalog";
import { gearIdentity } from "./identity";
import { itemSockets } from "./sockets";
import metaData from "../../../data/wotlk/meta-gem-conditions.json";

export const gemmingRevision = "gems-v1";
type MetaCondition = { minimum: number[]; greater?: number; lesser?: number };
const conditions: Record<string, MetaCondition> = metaData.conditions;
export function supportedMetaGem(id: number) {
  return Boolean(conditions[id]);
}
const colorParts: Partial<Record<GemColor, number[]>> = {
  [GemColor.GemColorRed]: [1, 0, 0],
  [GemColor.GemColorYellow]: [0, 1, 0],
  [GemColor.GemColorBlue]: [0, 0, 1],
  [GemColor.GemColorOrange]: [1, 1, 0],
  [GemColor.GemColorPurple]: [1, 0, 1],
  [GemColor.GemColorGreen]: [0, 1, 1],
  [GemColor.GemColorPrismatic]: [1, 1, 1],
};

export function metaDeficit(
  metaId: number,
  gemIds: number[],
  catalog: Catalog,
): number {
  const condition = conditions[metaId];
  if (!condition) return Infinity;
  const counts = [0, 0, 0];
  for (const id of gemIds) {
    const color = catalog.gems.get(id)?.color;
    colorParts[color ?? 0]?.forEach((n, index) => (counts[index] += n));
  }
  return (
    condition.minimum.reduce(
      (n, min, i) => n + Math.max(0, min - counts[i]),
      0,
    ) +
    (condition.greater !== undefined && condition.lesser !== undefined
      ? Math.max(0, counts[condition.lesser] - counts[condition.greater] + 1)
      : 0)
  );
}

export function hasJewelcrafting(snapshot: Snapshot) {
  const p = snapshot.settings.player!;
  return [p.profession1, p.profession2].includes(Profession.Jewelcrafting);
}
function ordinary(gem: UIGem) {
  return (
    gem.color !== GemColor.GemColorMeta &&
    !gem.requiredProfession &&
    !gem.unique
  );
}
function sameStats(a: UIGem, b: UIGem) {
  return a.stats.every((n, i) => Boolean(n) === Boolean(b.stats[i]));
}
function strongest(gems: UIGem[]) {
  return [...gems].sort(
    (a, b) =>
      b.stats.reduce((s, n) => s + n, 0) - a.stats.reduce((s, n) => s + n, 0) ||
      a.id - b.id,
  );
}

export function defaultGemming(snapshot: Snapshot): GemmingSettings {
  const catalog = getCatalog(snapshot.itemVersion);
  const equippedIds = new Set(Object.values(snapshot.equipped));
  const imported = snapshot.inventory
    .filter((i) => equippedIds.has(i.instanceId))
    .flatMap((i) => i.gemIds);
  const mostUsed = (predicate: (gem: UIGem) => boolean) => {
    const counts = new Map<number, number>();
    for (const id of imported) {
      const gem = catalog.gems.get(id);
      if (gem && predicate(gem)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  };
  const specModule = snapshot.specId.split(":")[0];
  const strength = ["deathknight", "warrior", "retribution_paladin"].includes(
    specModule,
  );
  const agility = [
    "hunter",
    "rogue",
    "feral_druid",
    "enhancement_shaman",
  ].includes(specModule);
  const normal =
    mostUsed(ordinary) ?? (strength ? 40111 : agility ? 40112 : 40113);
  const defaultGem = catalog.gems.get(normal)!;
  const jc =
    mostUsed((g) => g.requiredProfession === Profession.Jewelcrafting) ??
    strongest(
      [...catalog.gems.values()].filter(
        (g) =>
          g.requiredProfession === Profession.Jewelcrafting &&
          sameStats(g, defaultGem),
      ),
    )[0]?.id ??
    (strength ? 42142 : agility ? 42143 : 42144);
  return {
    enabled: true,
    defaultGemId: normal,
    metaGemId:
      mostUsed(
        (g) => g.color === GemColor.GemColorMeta && supportedMetaGem(g.id),
      ) ?? (strength || agility ? 41398 : 41285),
    jcGemId: jc,
  };
}

export function validateGemming(
  snapshot: Snapshot,
  catalog = getCatalog(snapshot.itemVersion),
) {
  const config = snapshot.gemming;
  if (!config?.enabled) return;
  const normal = catalog.gems.get(config.defaultGemId),
    meta = catalog.gems.get(config.metaGemId),
    jc = catalog.gems.get(config.jcGemId);
  if (!normal || !ordinary(normal))
    throw new Error("Choose an unrestricted default gem for normal sockets.");
  if (!meta || meta.color !== GemColor.GemColorMeta || !conditions[meta.id])
    throw new Error("Choose a supported meta gem.");
  if (!jc || jc.requiredProfession !== Profession.Jewelcrafting)
    throw new Error("Choose a Dragon’s Eye for Jewelcrafting sockets.");
  const rank = snapshot.professionLevels?.[Profession.Jewelcrafting];
  const requiredRank = catalog.restrictions?.items[jc.id]?.requiredSkillRank;
  if (
    hasJewelcrafting(snapshot) &&
    rank !== undefined &&
    requiredRank &&
    rank < requiredRank
  )
    throw new Error(
      `The selected Dragon’s Eye requires Jewelcrafting ${requiredRank}.`,
    );
}

export function withGemOverrides(
  snapshot: Snapshot,
  overrides: GemOverrides = {},
): Snapshot {
  if (!Object.keys(overrides).length) return snapshot;
  return {
    ...snapshot,
    inventory: snapshot.inventory.map((i) =>
      overrides[i.instanceId] ? { ...i, gemIds: overrides[i.instanceId] } : i,
    ),
  };
}

export function inactiveMetaIds(
  snapshot: Snapshot,
  loadout: Loadout,
  overrides: GemOverrides = {},
) {
  const resolved = withGemOverrides(snapshot, overrides);
  const selected = new Set(Object.values(loadout));
  const ids = resolved.inventory
    .filter((i) => selected.has(i.instanceId))
    .flatMap((i) => i.gemIds);
  const catalog = getCatalog(snapshot.itemVersion);
  return new Set(
    ids.filter(
      (id) =>
        catalog.gems.get(id)?.color === GemColor.GemColorMeta &&
        metaDeficit(id, ids, catalog) > 0,
    ),
  );
}

export function prepareGems(
  snapshot: Snapshot,
  loadout: Loadout,
  catalog = getCatalog(snapshot.itemVersion),
): { overrides: GemOverrides; warnings: string[] } {
  const config = snapshot.gemming;
  if (
    !config?.enabled ||
    gearIdentity(snapshot, loadout) ===
      gearIdentity(snapshot, snapshot.equipped)
  )
    return { overrides: {}, warnings: [] };
  validateGemming(snapshot, catalog);
  const selected = new Set(Object.values(loadout));
  const equipped = new Set(Object.values(snapshot.equipped));
  // Order by item content before instance ID so swapping paired slots or
  // selecting an identical physical copy cannot change where gems are placed.
  const items = snapshot.inventory
    .filter((i) => selected.has(i.instanceId))
    .sort(
      (a, b) =>
        Number(equipped.has(a.instanceId)) -
          Number(equipped.has(b.instanceId)) ||
        a.itemId - b.itemId ||
        a.enchantId - b.enchantId ||
        JSON.stringify(a.gemIds).localeCompare(JSON.stringify(b.gemIds)) ||
        a.instanceId.localeCompare(b.instanceId),
    );
  const arrays: GemOverrides = {};
  type Socket = { item: ItemInstance; index: number; color: GemColor };
  const sockets: Socket[] = [];
  for (const item of items) {
    const metadata = catalog.items.get(item.itemId);
    arrays[item.instanceId] = [...item.gemIds];
    if (!metadata) continue;
    itemSockets(snapshot, metadata).forEach((color, index) => {
      if (!arrays[item.instanceId][index])
        arrays[item.instanceId][index] =
          color === GemColor.GemColorMeta
            ? config.metaGemId
            : config.defaultGemId;
      sockets.push({ item, index, color });
    });
  }
  const gemId = (s: Socket) => arrays[s.item.instanceId][s.index];
  const setGem = (s: Socket, id: number) =>
    (arrays[s.item.instanceId][s.index] = id);
  const allGems = () => items.flatMap((i) => arrays[i.instanceId]);
  const isJc = (id: number) =>
    catalog.gems.get(id)?.requiredProfession === Profession.Jewelcrafting;
  const jcTarget = hasJewelcrafting(snapshot) ? 3 : 0;
  const jcSockets = sockets.filter((s) => isJc(gemId(s)));
  // Prefer retaining JC gems already on equipped pieces. Excess gems become
  // their ordinary stat equivalent, rather than invalidating an entire set.
  for (const s of [...jcSockets]
    .sort(
      (a, b) =>
        Number(equipped.has(b.item.instanceId)) -
        Number(equipped.has(a.item.instanceId)),
    )
    .slice(jcTarget)) {
    const current = catalog.gems.get(gemId(s))!;
    const replacement = strongest(
      [...catalog.gems.values()].filter(
        (g) => ordinary(g) && sameStats(g, current),
      ),
    )[0];
    setGem(s, replacement?.id ?? config.defaultGemId);
  }
  // Fill the profession quota before repairing meta colors. Meta repair never
  // removes JC gems, so both constraints are satisfied together when possible.
  const candidates = sockets.filter(
    (s) =>
      s.color !== GemColor.GemColorMeta &&
      !isJc(gemId(s)) &&
      !catalog.gems.get(gemId(s))?.unique,
  );
  const jcGem = catalog.gems.get(config.jcGemId)!;
  candidates.sort((a, b) => {
    const score = (s: Socket) => {
      const gem = catalog.gems.get(gemId(s))!;
      return (
        Number(sameStats(gem, jcGem)) * 4 +
        Number(gem.color === jcGem.color) * 2
      );
    };
    return score(b) - score(a);
  });
  let count = allGems().filter(isJc).length;
  for (const s of candidates) {
    if (count >= jcTarget) break;
    setGem(s, config.jcGemId);
    count++;
  }
  const warnings: string[] = [];
  if (count < jcTarget)
    warnings.push(
      `Only ${count} of 3 Dragon’s Eyes fit in this set’s available sockets.`,
    );

  const metas = sockets
    .filter((s) => s.color === GemColor.GemColorMeta)
    .map(gemId);
  const deficit = () =>
    metas.reduce((sum, id) => sum + metaDeficit(id, allGems(), catalog), 0);
  // Preserve existing colored/unique gems whenever possible. If a supporting
  // item was removed, restore a color with the fewest substitutions, favoring
  // the imported gem palette and then gems carrying the chosen default stats.
  const importedIds = new Set(
    snapshot.inventory
      .filter((i) => equipped.has(i.instanceId))
      .flatMap((i) => i.gemIds),
  );
  const normal = catalog.gems.get(config.defaultGemId)!;
  const score = (g: UIGem) =>
    g.stats.reduce(
      (sum, n, i) => sum + (normal.stats[i] ? n / normal.stats[i] : 0),
      0,
    );
  const palette = [...catalog.gems.values()]
    .filter((g) => (ordinary(g) || g.id === 49110) && !isJc(g.id))
    .sort(
      (a, b) =>
        Number(importedIds.has(b.id)) - Number(importedIds.has(a.id)) ||
        score(b) - score(a) ||
        a.id - b.id,
    );
  // Keep an unrestricted fallback for a unique gem's color (e.g. a second
  // prismatic socket cannot use a second Nightmare Tear).
  const representatives = new Map<string, UIGem>();
  for (const gem of palette) {
    const key = `${gem.color}:${gem.unique ? gem.id : "normal"}`;
    if (!representatives.has(key)) representatives.set(key, gem);
  }
  const repairGems = [...representatives.values()];
  for (let pass = 0; pass < sockets.length && deficit() > 0; pass++) {
    let best: { socket: Socket; gem: number; deficit: number } | undefined;
    for (const socket of sockets) {
      const before = gemId(socket);
      if (
        socket.color === GemColor.GemColorMeta ||
        isJc(before) ||
        catalog.gems.get(before)?.unique
      )
        continue;
      for (const gem of repairGems) {
        if (gem.unique && allGems().includes(gem.id)) continue;
        setGem(socket, gem.id);
        const remaining = deficit();
        setGem(socket, before);
        if (remaining < (best?.deficit ?? deficit()))
          best = { socket, gem: gem.id, deficit: remaining };
      }
    }
    if (!best) break;
    setGem(best.socket, best.gem);
  }
  if (deficit() > 0)
    warnings.push(
      "The meta gem’s color requirements cannot be met with this set’s available regular sockets.",
    );
  const overrides = Object.fromEntries(
    items
      .filter(
        (i) =>
          JSON.stringify(i.gemIds) !== JSON.stringify(arrays[i.instanceId]),
      )
      .map((i) => [i.instanceId, arrays[i.instanceId]]),
  );
  return { overrides, warnings };
}

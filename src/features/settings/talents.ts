import trees from "../../../data/wotlk/talent-trees.json";
import type { Snapshot } from "@/domain/top-gear/model";
export function talentPoints(snapshot: Snapshot) {
  return (snapshot.settings.player?.talentsString ?? "")
    .split("-")
    .map((tree) => [...tree].reduce((sum, p) => sum + Number(p), 0));
}
export function readTalents(snapshot: Snapshot): Record<string, number> {
  const player = snapshot.settings.player!;
  const data = (
    trees as Record<
      string,
      Array<{ talents: Array<{ fieldName?: string; maxPoints: number }> }>
    >
  )[String(player.class)];
  const strings = player.talentsString.split("-");
  return Object.fromEntries(
    (data ?? []).flatMap((tree, t) =>
      tree.talents.map((talent, i) => [
        talent.fieldName ?? "",
        Number(strings[t]?.[i] ?? 0),
      ]),
    ),
  );
}

export function validateTalents(snapshot: Snapshot): string[] {
  const p = snapshot.settings.player!;
  const data = (
    trees as Record<
      string,
      Array<{
        talents: Array<{
          maxPoints: number;
          location: { rowIdx: number; colIdx: number };
          prereqLocation?: { rowIdx: number; colIdx: number };
        }>;
      }>
    >
  )[String(p.class)];
  const strings = p.talentsString.split("-"),
    errors: string[] = [];
  let total = 0;
  for (const [treeIndex, tree] of (data ?? []).entries()) {
    const ranks = [...(strings[treeIndex] ?? "")].map(Number);
    if (ranks.length > tree.talents.length)
      errors.push("Talent string has too many entries");
    total += ranks.reduce((a, b) => a + b, 0);
    tree.talents.forEach((talent, i) => {
      const rank = ranks[i] ?? 0;
      if (rank > talent.maxPoints)
        errors.push("Talent rank exceeds its maximum");
      if (!rank) return;
      const earlier = tree.talents.reduce(
        (n, t, j) =>
          n +
          (t.location.rowIdx < talent.location.rowIdx ? (ranks[j] ?? 0) : 0),
        0,
      );
      if (earlier < talent.location.rowIdx * 5)
        errors.push("Talent tier requirement is not met");
      if (talent.prereqLocation) {
        const prerequisite = tree.talents.findIndex(
          (t) =>
            t.location.rowIdx === talent.prereqLocation!.rowIdx &&
            t.location.colIdx === talent.prereqLocation!.colIdx,
        );
        if (
          prerequisite < 0 ||
          (ranks[prerequisite] ?? 0) < tree.talents[prerequisite].maxPoints
        )
          errors.push("Talent prerequisite is not met");
      }
    });
  }
  if (total > 71)
    errors.push("A level 80 character has at most 71 talent points");
  return errors;
}

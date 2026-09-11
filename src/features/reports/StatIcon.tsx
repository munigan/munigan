import { Stat } from "@/generated/wotlk/common";

// One consistent 24px stroke family; every attribute has its own visual metaphor.
const icons: Partial<Record<Stat, string>> = {
  [Stat.StatStrength]: "M7 9h10M7 15h10M3 8v8m18-8v8M5 5h2v14H5zM17 5h2v14h-2z",
  [Stat.StatAgility]:
    "M4 19h9c3 0 6-2 7-5l-6-2-2-7H7l1 9-4 2v3ZM3 9h2M2 12h3M11 12l3-1",
  [Stat.StatIntellect]:
    "M12 5c-2-4-7-2-7 2-4 1-3 6-1 7-2 4 2 7 5 5 1 3 3 2 3 0V5Zm0 0c2-4 7-2 7 2 4 1 3 6 1 7 2 4-2 7-5 5-1 3-3 2-3 0M5 7l3 2M4 14l4-1m11-6-3 2m4 5-4-1",
  [Stat.StatSpirit]:
    "M13 2c1 5-4 6-2 10 2-1 3-3 3-5 5 4 7 7 5 11-2 5-11 5-14 0-2-4 0-8 3-10-1 5 0 6 2 7",
  [Stat.StatAttackPower]:
    "m14 4 6-1-1 6-9 9-4-4 8-10ZM4 12l8 8M8 16l-5 5M2 20l2 2",
  [Stat.StatRangedAttackPower]:
    "M5 3c17 2 17 16 0 18L12 12 5 3ZM3 12h18m-4-4 4 4-4 4",
  [Stat.StatArmorPenetration]:
    "M10 3 3 6v6c0 5 7 9 7 9s7-4 7-9V6l-7-3ZM21 3 8 16m0-5v5h5M13 7l-3 4 3 2-3 4",
  [Stat.StatMeleeCrit]:
    "m13 4 5-1-1 5-7 7-3-3 6-8ZM5 12l7 7M8 15l-5 5m13-5 1 4m2-7 3 2M5 7 2 6m6-2-1-2",
  [Stat.StatMeleeHaste]: "M14 3 8 12h5l-3 9 10-12h-6l2-6ZM3 7h5M2 12h3M3 17h3",
  [Stat.StatMeleeHit]:
    "M19 11a8 8 0 1 1-6-7M15 11a4 4 0 1 1-4-3M11 12 21 2m-5 0h5v5",
  [Stat.StatSpellPower]:
    "m4 20 11-11 3 3L7 23 4 20ZM17 2v4m-2-2h4M6 6v4M4 8h4m12 7v4m-2-2h4",
  [Stat.StatSpellCrit]:
    "m12 2 2 6 6-3-3 6 5 2-6 2 2 6-6-4-5 4 1-7-6-2 6-2-3-6 6 3 1-6ZM12 9v5m0 3h.01",
  [Stat.StatSpellHaste]:
    "M10 4h11M7 8h6M3 12h5m1 7 8-8 3 3-8 8-3-3Zm10-6 3-3M17 4v4m-2-2h4",
  [Stat.StatSpellHit]:
    "M20 12a8 8 0 1 1-8-8M16 12a4 4 0 1 1-4-4m6-7 1.5 4.5L24 7l-4.5 1.5L18 13l-1.5-4.5L12 7l4.5-1.5L18 1Z",
  [Stat.StatExpertise]:
    "m15 3 6 0 0 6-10 10-3-3L15 3ZM6 14l6 6M8 18l-4 4M3 3h6l5 7-4 4L3 9V3Zm11 15 4 4m-2-8 4 6",
};

export function StatIcon({ stat }: { stat: Stat }) {
  return (
    <svg
      className="stat-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[stat] ?? "M4 18v-5m8 5V6m8 12V3"} />
    </svg>
  );
}

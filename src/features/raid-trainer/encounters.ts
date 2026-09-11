import type { Actor, EncounterDefinition } from "./model";

const actor = (
  id: string,
  name: string,
  x: number,
  y: number,
  color: string,
): Actor => ({
  id,
  name,
  x,
  y,
  color,
  role: id === "you" ? "player" : "raid",
  radius: 8,
  home: { x, y },
});

export const lichKingDefile: EncounterDefinition = {
  id: "lich-king-defile",
  raidId: "icecrown-citadel",
  name: "The Lich King",
  subtitle: "Defile · positioning drill",
  location: "The Frozen Throne",
  lesson: {
    summary: "Place Defile away from the raid, then get clear before it grows.",
    steps: [
      ["Anticipate", "Watch the bar. Find your escape route."],
      ["Place", "If targeted, move away from teammates."],
      ["Escape", "Leave the pool. Keep the raid’s path clear."],
    ],
  },
  duration: 57,
  arena: { center: { x: 400, y: 340 }, radius: 275, width: 800, height: 680 },
  boss: {
    x: 400,
    y: 280,
    name: "THE LICH KING",
    portrait: "/raid-trainer/art/lich-king.jpg",
  },
  artwork: "/raid-trainer/art/frozen-arena.png",
  actors: [
    actor("you", "YOU", 420, 420, "#e8fa8a"),
    actor("mira", "Mira", 373, 386, "#aa9af5"),
    actor("orin", "Orin", 405, 382, "#7acbe8"),
    actor("ash", "Ash", 441, 391, "#f3a78c"),
    actor("wyn", "Wyn", 350, 416, "#7acbe8"),
    actor("vale", "Vale", 387, 425, "#a3d5ba"),
    actor("rue", "Rue", 454, 433, "#aa9af5"),
    actor("kael", "Kael", 374, 459, "#f3a78c"),
    actor("sol", "Sol", 426, 468, "#a3d5ba"),
    actor("ryn", "Ryn", 461, 467, "#7acbe8"),
  ],
  abilities: {
    defile: {
      id: "defile",
      name: "Defile",
      icon: "/raid-trainer/art/defile.jpg",
      color: "#b393f5",
      castSeconds: 3,
      warningSeconds: 5,
      regroupAfterSeconds: 7,
      mechanic: {
        kind: "growing-pool",
        radius: 36,
        growthPerHit: 7,
        tickSeconds: 1,
        lifetimeSeconds: 14,
      },
    },
  },
  timeline: [
    { id: "defile-1", at: 8, abilityId: "defile", target: "player" },
    { id: "defile-2", at: 25, abilityId: "defile", target: "raid" },
    { id: "defile-3", at: 42, abilityId: "defile", target: "player" },
  ],
};

export const raidCatalog = [
  {
    id: "icecrown-citadel",
    name: "Icecrown Citadel",
    expansion: "Wrath of the Lich King",
    encounters: [lichKingDefile],
  },
];

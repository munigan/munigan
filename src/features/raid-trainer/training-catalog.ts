import { lichKingDefile } from "./encounters";
import type { EncounterDefinition } from "./model";

export type TrainingDrill = {
  id: string;
  name: string;
  icon: string;
  summary: string;
  goal: string;
  roles: string;
  difficulties: string;
  phases: string;
  steps: readonly (readonly [string, string])[];
  reference: string;
  preview: "defile-placement";
  simulation: EncounterDefinition;
};

type TrainingRaid = {
  id: string;
  name: string;
  image: string;
  edition: string;
  encounters: {
    id: string;
    name: string;
    portrait: string;
    drills: TrainingDrill[];
  }[];
};

/** Only playable drills belong here. Encounter mechanics and training metadata stay independent. */
export const trainingCatalog: TrainingRaid[] = [
  {
    id: "icecrown-citadel",
    name: "Icecrown Citadel",
    image: "/raid-trainer/art/icecrown-citadel.png",
    edition: "Wrath Classic",
    encounters: [
      {
        id: "lich-king",
        name: "The Lich King",
        portrait: "/raid-trainer/art/lich-king.jpg",
        drills: [
          {
            id: "defile",
            name: "Defile",
            icon: "/raid-trainer/art/defile.jpg",
            summary: "A pool forms at the target. Damage ticks make it grow.",
            goal: "Keep yourself and the raid out of the pool.",
            roles: "All roles",
            difficulties: "Normal + Heroic",
            phases: "Phases 2 & 3",
            steps: [
              ["Read the timer", "Choose open ground before the cast."],
              ["Place it away", "If targeted, move away from teammates."],
              ["Keep moving", "Leave the pool and keep a clear return path."],
            ],
            reference:
              "https://www.wowhead.com/wotlk/guide/raids/icecrown-citadel/the-lich-king-strategy",
            preview: "defile-placement",
            simulation: lichKingDefile,
          },
        ],
      },
    ],
  },
];

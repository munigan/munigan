import {
  makeRun,
  scenarioFamilies,
  scenarioVariantIds,
} from "./scenario-content";
import type { Family, Focus, RunSpec } from "./scenario-model";

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
  focus: Focus;
  families: readonly Family[];
  defaultSelection: Family | "mixed";
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
    edition: "Working reference: Warmane 3.3.5, 25-player Heroic",
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
            roles: "Melee damage dealer",
            difficulties: "25-player Heroic positioning practice",
            phases: "Phases 2 & 3",
            steps: [
              ["Read the timer", "Choose open ground before the cast."],
              ["Place it away", "If targeted, move away from teammates."],
              ["Keep moving", "Leave the pool and keep a clear return path."],
            ],
            reference: "https://forum.warmane.com/showthread.php?t=324235",
            preview: "defile-placement",
            focus: "defile",
            families: scenarioFamilies,
            defaultSelection: "mixed",
          },
        ],
      },
    ],
  },
];

export type ScenarioSelection = Family | "mixed";
export const familyLabels: Record<Family, string> = {
  "before-valkyrs": "Defile before Val’kyrs",
  "after-valkyrs": "Defile after Val’kyr pickups",
  "vile-spirits": "Defile during Vile Spirits",
  "frostmourne-return": "Defile after Frostmourne return",
};
export function selectedRun(
  drill: TrainingDrill,
  selection: ScenarioSelection,
  variationIndex = 0,
): RunSpec {
  const family =
    selection === "mixed"
      ? drill.families[variationIndex % drill.families.length]
      : selection;
  const variants = scenarioVariantIds(family);
  const index =
    selection === "mixed"
      ? Math.floor(variationIndex / drill.families.length)
      : 0;
  return makeRun(
    variants[index % variants.length],
    41 + variationIndex,
    drill.focus,
    "timers",
  );
}
export function supportingMechanics(run: RunSpec) {
  return run.scenario.family === "before-valkyrs" ||
    run.scenario.family === "after-valkyrs"
    ? "Val’kyrs"
    : "Vile Spirits";
}
export function variationLabel(run: RunSpec) {
  const labels: Record<string, string> = {
    "before-standard": "Standard spacing",
    "before-tight": "Tight overlap",
    "after-standard": "Standard spacing",
    "after-tight": "Tight overlap",
    "spirits-moving": "Moving raid",
    "spirits-settled": "Settled raid",
    "frostmourne-return": "Platform return",
  };
  return `${familyLabels[run.scenario.family]} · ${labels[run.scenario.variantId.replace(/-(you|neighbor)$/, "")] ?? "Positioning practice"}`;
}
export const practiceScope =
  "You control a melee damage dealer; the class portrait identifies your character, not class spells. NPCs handle combat support and Val’kyr rescues; you are not selected for pickup. Combat support and some timing and geometry are approximated. The Frostmourne exercise begins on the platform after the return.";

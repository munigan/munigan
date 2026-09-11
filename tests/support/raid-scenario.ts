import type {
  Attempt,
  Focus,
} from "../../src/features/raid-trainer/scenario-model";
import { makeRun } from "../../src/features/raid-trainer/scenario-content";
import {
  advanceAttempt,
  createAttempt,
} from "../../src/features/raid-trainer/scenario-runtime";

export function running(variantId: string, seed = 7, focus: Focus = "defile") {
  const attempt = createAttempt(makeRun(variantId, seed, focus));
  attempt.world.status = "running";
  return attempt;
}

export type InputSegment = {
  seconds: number;
  direction: { x: number; y: number };
};
export function playTrace(attempt: Attempt, trace: readonly InputSegment[]) {
  for (const segment of trace)
    advanceAttempt(attempt, segment.seconds, segment.direction);
}
// Measured ordinary movement at seeds 7 and 18. Durations are relative; cumulative
// segment endpoints provide the timestamped input schedule from encounter GO.
export const successTraces: Record<string, readonly InputSegment[]> = {
  "before-standard-you": [
    {
      seconds: 8.15,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.8999999999999986,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 46.05,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "before-standard-neighbor": [
    {
      seconds: 60,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "before-tight-you": [
    {
      seconds: 8.15,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.8999999999999986,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 46.05,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "before-tight-neighbor": [
    {
      seconds: 60,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "after-standard-you": [
    {
      seconds: 13.15,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.8999999999999986,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 41.05,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "after-standard-neighbor": [
    {
      seconds: 60,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "after-tight-you": [
    {
      seconds: 8.4,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.8999999999999986,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 45.8,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "after-tight-neighbor": [
    {
      seconds: 60,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "spirits-moving-you": [
    {
      seconds: 4,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 4.15,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.1499999999999986,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 45.9,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "spirits-moving-neighbor": [
    {
      seconds: 4,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 6.285714285714285,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 49.71666666666667,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "spirits-settled-you": [
    {
      seconds: 8.15,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.8999999999999986,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 46.05,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "spirits-settled-neighbor": [
    {
      seconds: 60,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "frostmourne-return-you": [
    {
      seconds: 3.15,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 1.9,
      direction: {
        x: 1,
        y: 0,
      },
    },
    {
      seconds: 1,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 1.9000000000000004,
      direction: {
        x: -1,
        y: 0,
      },
    },
    {
      seconds: 0.9999999999999991,
      direction: {
        x: 0,
        y: -1,
      },
    },
    {
      seconds: 3.0500000000000007,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 3.1428571428571423,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 44.86666666666667,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
  "frostmourne-return-neighbor": [
    {
      seconds: 12,
      direction: {
        x: 0,
        y: 0,
      },
    },
    {
      seconds: 3.1428571428571423,
      direction: {
        x: 0,
        y: 1,
      },
    },
    {
      seconds: 44.86666666666667,
      direction: {
        x: 0,
        y: 0,
      },
    },
  ],
};

// Separate ordinary-input mistakes. No actor edits, damage suppression or skipped assessment.
export const failureTraces = {
  stackCamping: {
    variantId: "before-standard-you",
    seed: 7,
    trace: [{ seconds: 30, direction: { x: 0, y: 0 } }],
  },
  followingTarget: {
    variantId: "before-standard-neighbor",
    seed: 7,
    trace: [
      { seconds: 8.6, direction: { x: 0, y: 0 } },
      { seconds: 1.4, direction: { x: 1, y: 0 } },
      { seconds: 20, direction: { x: 0, y: 0 } },
    ],
  },
  routeOverlap: {
    variantId: "before-standard-you",
    seed: 7,
    trace: [
      { seconds: 8.15, direction: { x: 0, y: 0 } },
      { seconds: 1.9, direction: { x: 0, y: 1 } },
      { seconds: 1, direction: { x: 1, y: 0 } },
      { seconds: 1.9, direction: { x: 0, y: -1 } },
      { seconds: 1, direction: { x: -1, y: 0 } },
      { seconds: 30, direction: { x: 0, y: 0 } },
    ],
  },
  spiritExposure: {
    variantId: "spirits-settled-you",
    seed: 7,
    trace: [
      ...successTraces["spirits-settled-you"].slice(0, -1),
      { seconds: 1.9, direction: { x: 0, y: -1 } },
      { seconds: 30, direction: { x: 0, y: 0 } },
    ],
  },
} satisfies Record<
  string,
  { variantId: string; seed: number; trace: readonly InputSegment[] }
>;

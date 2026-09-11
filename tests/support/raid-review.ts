import { makeRun } from "../../src/features/raid-trainer/scenario-content";
import {
  advanceAttempt,
  createAttempt,
} from "../../src/features/raid-trainer/scenario-runtime";
import {
  createRecording,
  recordStep,
} from "../../src/features/raid-trainer/scenario-recording";

// Ordinary input durations measured from GO; never edit actors or assessment.
export const reviewTraces = {
  route: {
    variant: "before-standard-you",
    input: [
      [8.15, 0, 0],
      [0.9, 1, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 0, -1],
      [1.9, -1, 0],
      [30, 0, 0],
    ],
  },
  neighbor: {
    variant: "before-standard-neighbor",
    input: [
      [10, 0, 0],
      [1.2, 1, 0],
      [1.2, -1, 0],
      [30, 0, 0],
    ],
  },
  supporting: { variant: "spirits-moving-neighbor", input: [[60, 0, 0]] },
} as const;
export function recordedReview(name: keyof typeof reviewTraces) {
  const trace = reviewTraces[name];
  const attempt = createAttempt(makeRun(trace.variant, 7));
  attempt.world.status = "running";
  const recording = createRecording();
  recordStep(recording, attempt);
  for (const [seconds, x, y] of trace.input)
    advanceAttempt(attempt, seconds, { x, y }, (step) =>
      recordStep(recording, step),
    );
  return { attempt, recording };
}

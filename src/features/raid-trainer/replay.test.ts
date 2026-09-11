import { expect, it } from "vitest";
import { advanceReplay } from "./replay";

it("replays irregularly captured frames by their timestamps rather than frame count", () => {
  const frames = [
    { elapsed: 0 },
    { elapsed: 0.16 },
    { elapsed: 0.5 },
    { elapsed: 2 },
  ];
  expect(advanceReplay(frames, 0, 1)).toEqual({
    elapsed: 1,
    index: 2,
    ended: false,
  });
  expect(advanceReplay(frames, 1, 3)).toEqual({
    elapsed: 2,
    index: 3,
    ended: true,
  });
});

it("seeks immutable event IDs to frames containing supporting and primary events", async () => {
  const { makeRun } = await import("./scenario-content");
  const { createAttempt, advanceAttempt } = await import("./scenario-runtime");
  const { createRecording, recordStep, frameView } =
    await import("./scenario-recording");
  const { eventReplayTime } = await import("./replay");
  const attempt = createAttempt(makeRun("spirits-moving-you", 41));
  const recording = createRecording();
  recordStep(recording, attempt);
  attempt.world.status = "running";
  while (attempt.world.status === "running")
    advanceAttempt(attempt, 0.17, { x: 0, y: 0 }, (step) =>
      recordStep(recording, step),
    );
  for (const event of recording.events) {
    const elapsed = eventReplayTime(recording, structuredClone(event));
    const index = advanceReplay(
      recording.frames.map((frame) => frame.world),
      elapsed,
      0,
    ).index;
    expect(frameView(recording, index).events).toContainEqual(event);
  }
});

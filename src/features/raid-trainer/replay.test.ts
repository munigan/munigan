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

it("seeks an event to a frame that contains it under uneven render timing", async () => {
  const { lichKingDefile } = await import("./encounters");
  const { createSession, advanceSession, snapshot } =
    await import("./simulation");
  const { eventReplayTime } = await import("./replay");
  const state = createSession(lichKingDefile);
  state.status = "running";
  const frames = [snapshot(state)];
  let tick = 0;
  while (state.status === "running") {
    advanceSession(state, tick++ % 23 === 0 ? 0.07 : 0.016);
    const previous = frames.at(-1)!;
    if (state.elapsed - previous.elapsed >= 0.099 || state.status !== "running")
      frames.push(snapshot(state));
  }
  for (const event of state.events) {
    const elapsed = eventReplayTime(frames, event);
    const found = frames[advanceReplay(frames, elapsed, 0).index];
    expect(found.events).toContainEqual(event);
    if (event.kind === "pool") expect(found.pools.length).toBeGreaterThan(0);
    if (event.personalHits) expect(found.stats.personalHits).toBeGreaterThan(0);
  }
});

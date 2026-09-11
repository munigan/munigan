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

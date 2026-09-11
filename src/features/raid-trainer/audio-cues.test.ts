import { describe, expect, it } from "vitest";
import { audioCues, audioFrame } from "./audio-cues";
import { createSession, advanceSession } from "./simulation";
import { lichKingDefile } from "./encounters";

describe("encounter audio", () => {
  it("announces countdown crossings once and does not repeat at high refresh rates", () => {
    const s = createSession(lichKingDefile);
    s.status = "running";
    advanceSession(s, 4.9);
    const before = audioFrame(s);
    advanceSession(s, 0.2);
    const after = audioFrame(s);
    expect(audioCues(before, after, lichKingDefile, "timers")).toEqual([
      "count-3",
    ]);
    expect(audioCues(after, after, lichKingDefile, "timers")).toEqual([]);
  });
  it("announces the actual cast target, never the hidden future target", () => {
    const s = createSession(lichKingDefile);
    s.status = "running";
    advanceSession(s, 7.9);
    const before = audioFrame(s);
    expect(audioCues(before, before, lichKingDefile, "guided")).toEqual([]);
    advanceSession(s, 0.2);
    expect(audioCues(before, audioFrame(s), lichKingDefile, "guided")).toEqual([
      "target",
    ]);
  });
  it("removes advance coaching in timers mode and stays silent while paused", () => {
    const s = createSession(lichKingDefile);
    s.status = "running";
    advanceSession(s, 2.9);
    const before = audioFrame(s);
    advanceSession(s, 0.2);
    expect(audioCues(before, audioFrame(s), lichKingDefile, "guided")).toEqual([
      "spread",
    ]);
    expect(audioCues(before, audioFrame(s), lichKingDefile, "timers")).toEqual(
      [],
    );
    s.status = "paused";
    expect(audioCues(before, audioFrame(s), lichKingDefile, "guided")).toEqual(
      [],
    );
  });
});

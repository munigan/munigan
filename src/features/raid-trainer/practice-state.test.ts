import { expect, it } from "vitest";
import { lichKingDefile as encounter } from "./encounters";
import { advanceSession, createSession, snapshot } from "./simulation";
import {
  castReview,
  outcome,
  practiceCue,
  restorePractice,
} from "./practice-state";

it("reports the actual failed cast without claiming unreached casts were clean", () => {
  const s = createSession(encounter);
  s.status = "running";
  advanceSession(s, 20);
  expect(outcome(s)).toBe("exposure");
  const review = castReview(encounter, s);
  expect(review[0]).toMatchObject({ personal: 6, raid: 0, reached: true });
  expect(review[1].reached).toBe(false);
});
it("retains target and danger alerts with coaching disabled, then shows recovery", () => {
  const s = createSession(encounter);
  s.status = "running";
  advanceSession(s, 4);
  expect(practiceCue(s, encounter, "timers")).toBeNull();
  advanceSession(s, 4);
  expect(practiceCue(s, encounter, "timers")?.id).toBe("target");
  advanceSession(s, 4);
  expect(practiceCue(s, encounter, "timers")?.id).toBe("danger");
  advanceSession(s, 0.6, { x: 1, y: 0 });
  expect(practiceCue(s, encounter, "guided")?.id).toBe("recovered");
});
it("restores a cast checkpoint including positions, pools and seed without changing the recording", () => {
  const s = createSession(encounter, 7);
  s.status = "running";
  const frames = [snapshot(s)];
  for (let i = 0; i < 80; i++) {
    advanceSession(s, 0.1, { x: i < 50 ? 1 : 0, y: 0 });
    frames.push(snapshot(s));
  }
  const saved = structuredClone(frames);
  const result = restorePractice(encounter, frames, "defile-1", 7)!;
  expect(result.session.elapsed).toBeCloseTo(6);
  expect(result.session.seed).toBe(7);
  expect(result.session.actors).toEqual(frames[60].actors);
  advanceSession(result.session, 5);
  expect(result.session.elapsed).toBeCloseTo(6);
  result.session.status = "running";
  advanceSession(result.session, 2);
  expect(result.session.casts[0].targetId).toBe("you");
  expect(frames).toEqual(saved);
});
it("distinguishes raid damage, personal exposure and platform overrun", () => {
  const s = createSession(encounter);
  s.status = "complete";
  expect(outcome(s)).toBe("clean");
  s.stats.raidHits = 1;
  expect(outcome(s)).toBe("imperfect");
  s.status = "failed";
  expect(outcome(s)).toBe("overrun");
});

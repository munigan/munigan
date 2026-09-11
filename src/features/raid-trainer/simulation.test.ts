import { describe, expect, it } from "vitest";
import { lichKingDefile } from "./encounters";
import { advanceSession, createSession, getTimers } from "./simulation";
import type { EncounterDefinition } from "./model";

function running(encounter = lichKingDefile) {
  const s = createSession(encounter);
  s.status = "running";
  return s;
}

describe("raid training simulation", () => {
  it("places the pool at the target's position at cast completion, not cast start", () => {
    const s = running();
    advanceSession(s, 8);
    expect(s.casts[0]?.targetId).toBe("you");
    expect(s.pools).toHaveLength(0);
    advanceSession(s, 3, { x: 1, y: 0 });
    expect(s.pools).toHaveLength(1);
    expect(s.pools[0].x).toBeCloseTo(s.actors[0].x);
    expect(s.pools[0].x).toBeGreaterThan(600);
  });

  it("grows only on damage ticks and removes expired pools", () => {
    const fixture = structuredClone(lichKingDefile);
    fixture.actors = [fixture.actors[0]];
    fixture.timeline = [fixture.timeline[0]];
    const s = running(fixture);
    advanceSession(s, 11);
    expect(s.pools[0]?.radius).toBe(36);
    advanceSession(s, 1);
    expect(s.stats.personalHits).toBe(1);
    expect(s.pools[0].radius).toBe(43);
    advanceSession(s, 1, { x: 1, y: 0 });
    advanceSession(s, 2);
    expect(s.stats.personalHits).toBe(1);
    expect(s.pools[0].radius).toBe(43);
    advanceSession(s, 10);
    expect(s.pools).toHaveLength(0);
  });

  it("uses the same fixed steps at different display frame rates", () => {
    const slow = running();
    const fast = running();
    for (let i = 0; i < 30; i++) advanceSession(slow, 1 / 30, { x: 1, y: -1 });
    for (let i = 0; i < 144; i++)
      advanceSession(fast, 1 / 144, { x: 1, y: -1 });
    expect(slow.step).toBe(60);
    expect(fast.step).toBe(60);
    expect(slow.actors[0].x).toBeCloseTo(fast.actors[0].x, 6);
    expect(
      Math.hypot(slow.actors[0].x - 420, slow.actors[0].y - 420),
    ).toBeCloseTo(125);
  });

  it("freezes all state when paused", () => {
    const s = running();
    advanceSession(s, 9);
    s.status = "paused";
    const before = structuredClone(s);
    advanceSession(s, 40, { x: 1, y: 0 });
    expect(s).toEqual(before);
  });

  it("synchronizes upcoming bars, active cast bars, and executed events", () => {
    const s = running();
    expect(getTimers(s)[0]).toMatchObject({ kind: "upcoming", remaining: 8 });
    advanceSession(s, 8);
    expect(getTimers(s)[0]).toMatchObject({ kind: "cast", remaining: 3 });
    advanceSession(s, 3);
    expect(getTimers(s).some((t) => t.kind === "cast")).toBe(false);
    expect(s.stats.casts).toBe(1);
    expect(getTimers(s).find((t) => t.kind === "upcoming")?.remaining).toBe(14);
  });

  it("runs a second encounter with renamed abilities and different timing using only data", () => {
    const fixture: EncounterDefinition = {
      ...structuredClone(lichKingDefile),
      id: "another-boss",
      name: "Another boss",
      duration: 5,
      abilities: {
        blight: {
          ...lichKingDefile.abilities.defile,
          id: "blight",
          name: "Blight",
          castSeconds: 1,
        },
      },
      timeline: [
        { id: "blight-one", at: 1, abilityId: "blight", target: "player" },
      ],
    };
    const s = running(fixture);
    advanceSession(s, 2);
    expect(s.pools[0]?.abilityId).toBe("blight");
    expect(s.stats.casts).toBe(1);
    expect(s.events.some((e) => e.text.includes("Blight"))).toBe(true);
    advanceSession(s, 3, { x: 1, y: 0 });
    expect(s.status).toBe("complete");
  });
});

it("records the actor, pool and cast behind each damage tick for replay", () => {
  const state = createSession(lichKingDefile);
  state.status = "running";
  advanceSession(state, 12.1);
  const damage = state.events.find((event) => event.kind === "damage");
  expect(damage).toMatchObject({
    castId: "defile-1",
    actorIds: expect.arrayContaining(["you"]),
    personalHits: 1,
    position: { x: 420, y: 420 },
  });
});

it("exposes exact fixed-step checkpoints even across uneven render frames", () => {
  const s = running();
  let checkpoint: ReturnType<typeof structuredClone> | undefined;
  for (let frame = 0; frame < 150; frame++)
    advanceSession(s, 0.047, { x: 1, y: 0 }, (step) => {
      if (step.step === 360)
        checkpoint = structuredClone({
          elapsed: step.elapsed,
          actors: step.actors,
        });
    });
  expect(checkpoint).toMatchObject({ elapsed: 6 });
});

import { describe, expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { makeRun } from "./scenario-content";
import { emitEvent } from "./scenario-events";
import { advanceAttempt, createAttempt } from "./scenario-runtime";
import { readAttempt, readWorldView } from "./scenario-view";

describe("scenario view", () => {
  it("shows both mechanic timers without revealing the Defile target early", () => {
    const a = running("before-tight-you");
    advanceAttempt(a, 8.05, { x: 0, y: 0 });
    const view = readAttempt(a);
    expect(view.world.casts[0].targetId).toBeNull();
    expect("targetCase" in view.world.casts[0]).toBe(false);
    expect("mind" in view.world.actors[0]).toBe(false);
    expect(view.timers.some((t) => t.mechanic === "defile")).toBe(true);
    expect(view.timers.some((t) => t.mechanic === "valkyrs")).toBe(true);
    expect(view.cue?.title).not.toContain("on you");
  });

  it("projects an owned observable world without future-born spirits", () => {
    const a = running("spirits-moving-neighbor");
    const future = structuredClone(a.world.spirits[0]);
    future.id = "future";
    future.bornAt = 2;
    future.activeAt = 32;
    a.world.spirits.push(future);
    const view = readAttempt(a);
    expect(view.world.spirits.some((spirit) => spirit.id === "future")).toBe(
      false,
    );
    view.world.actors[0].x = 999;
    view.world.events[0].actorIds.push("changed");
    expect(a.world.actors[0].x).not.toBe(999);
    expect(a.world.events[0].actorIds).not.toContain("changed");
  });

  it("reveals an actual target and keeps cast timing on the authored clock", () => {
    const a = running("before-tight-you");
    const authored = a.run.scenario.events.find(
      (event) => event.kind === "defile",
    )!;
    authored.at = 8.005;
    advanceAttempt(a, 8.02, { x: 0, y: 0 });
    const started = readAttempt(a);
    const cast = started.timers.find((timer) => timer.kind === "cast")!;
    expect(cast.remaining).toBeCloseTo(
      8.005 + a.run.profile.defile.cast - a.world.elapsed,
    );
    expect(started.world.casts[0].targetId).toBeNull();
    advanceAttempt(a, 0.11, { x: 0, y: 0 });
    expect(readAttempt(a).world.casts[0].targetId).toBe("you");
  });

  it("keeps the physical projection identical between guided and timers modes", () => {
    const guided = createAttempt(
      makeRun("after-tight-neighbor", 19, "defile", "guided"),
    );
    const timers = createAttempt(
      makeRun("after-tight-neighbor", 19, "defile", "timers"),
    );
    guided.world.status = "running";
    timers.world.status = "running";
    advanceAttempt(guided, 8.4, { x: 1, y: 0 });
    advanceAttempt(timers, 8.4, { x: 1, y: 0 });
    expect(readAttempt(guided).world).toEqual(readAttempt(timers).world);
  });

  it("removes advance coaching in timers mode but retains target and hazard warnings", () => {
    const guided = running("before-standard-you");
    guided.run.mode = "guided";
    advanceAttempt(guided, 3.1, { x: 0, y: 0 });
    expect(readAttempt(guided).cue?.id).toBe("anticipate-defile");
    guided.run.mode = "timers";
    expect(readAttempt(guided).cue).toBeNull();

    advanceAttempt(guided, 5.1, { x: 0, y: 0 });
    expect(readAttempt(guided).cue?.id).toBe("target-you");
    advanceAttempt(guided, 2.9, { x: 0, y: 0 });
    expect(readAttempt(guided).cue?.id).toMatch(/^danger-/);
  });

  it("holds the Val'kyr stack until the final pickup then releases it", () => {
    const a = running("after-standard-neighbor");
    a.run.mode = "guided";
    advanceAttempt(a, 6.9, { x: 0, y: 0 });
    expect(readAttempt(a).cue).toMatchObject({
      id: "anticipate-valkyrs-stack",
      title: "Hold the stack",
    });

    advanceAttempt(a, 0.2, { x: 0, y: 0 });
    expect(readAttempt(a).cue).toMatchObject({
      id: "valkyrs-released",
      title: "Spread after the pickups",
    });
  });

  it("keeps a revealed distant target identified without claiming it is hidden", () => {
    const a = running("before-tight-neighbor");
    advanceAttempt(a, 8.15, { x: 0, y: 0 });
    const cast = a.world.casts[0];
    const target = a.world.actors.find((actor) => actor.id === cast.targetId)!;
    target.x = 30;
    target.y = 30;
    const cue = readAttempt(a).cue;
    expect(cast.targetId).not.toBeNull();
    expect(cue).toMatchObject({ id: `target-distant-${target.id}` });
    expect(cue?.label).toContain(target.name);
    expect(`${cue?.title} ${cue?.detail}`).not.toMatch(/not been revealed/i);
  });

  it("prioritizes an unprotected supporting explosion over guided coaching", () => {
    const a = running("before-standard-neighbor");
    a.run.mode = "guided";
    advanceAttempt(a, 3.1, { x: 0, y: 0 });
    emitEvent(a, {
      kind: "explosion",
      sourceId: "supporting-spirit",
      mechanic: "vile-spirits",
      actorIds: ["you"],
      checkpointId: "start",
    });
    expect(readAttempt(a).cue).toMatchObject({
      id: "danger-explosion",
      tone: "danger",
    });
  });

  it("surfaces an unprotected teammate explosion as immediate supporting danger", () => {
    const a = running("before-standard-neighbor");
    a.run.mode = "guided";
    advanceAttempt(a, 3.1, { x: 0, y: 0 });
    emitEvent(a, {
      kind: "explosion",
      sourceId: "supporting-spirit",
      mechanic: "vile-spirits",
      actorIds: ["raid-02", "soaker"],
      protectedActorIds: ["soaker"],
      checkpointId: "start",
    });
    expect(readAttempt(a).cue).toMatchObject({
      id: "danger-explosion",
      tone: "danger",
    });
  });

  it("explains recording interruption without presenting a mechanic mistake", () => {
    const a = running("before-standard-you");
    a.world.status = "failed";
    a.world.endReason = "recording-limit";
    const cue = readWorldView(a.run, a.world, a.findings).cue;
    expect(cue).toMatchObject({ id: "recording-interrupted", tone: "neutral" });
    expect(`${cue?.title} ${cue?.detail}`).toMatch(/recording.*interrupt/i);
    expect(`${cue?.title} ${cue?.detail}`).not.toMatch(
      /mistake|failed mechanic/i,
    );
  });
});

it("briefly acknowledges recovery after real personal exposure without hiding immediate danger or revealed targets", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 11.1, { x: 0, y: 0 });
  const misses = structuredClone(attempt.findings);
  expect(readAttempt(attempt).cue?.tone).toBe("danger");
  advanceAttempt(attempt, 1.1, { x: 1, y: 0 });
  expect(readAttempt(attempt).cue?.id).toBe("recovered");
  expect(readAttempt(attempt).cue?.tone).toBe("success");
  expect(attempt.findings).toEqual(misses);
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  const pool = attempt.world.pools[0];
  const clear = { x: you.x, y: you.y };
  you.x = pool.x;
  you.y = pool.y;
  expect(readAttempt(attempt).cue?.tone).toBe("danger");
  Object.assign(you, clear);
  attempt.world.casts.push({
    id: "new-cast",
    startedAt: 12,
    revealAt: 12,
    resolvesAt: 14,
    targetCase: "you",
    targetId: "you",
    resolved: false,
  });
  expect(readAttempt(attempt).cue?.id).toBe("target-you");
});

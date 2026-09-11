import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRoster, makeRun, validateRun } from "./scenario-content";

describe("shared raid scenarios", () => {
  it("defines 25 actors and never inherits old cast timing", () => {
    const run = makeRun("before-standard-you", 7);
    expect(validateRun(run)).toEqual([]);
    expect(createRoster(run)).toHaveLength(25);
    expect(run.profile.defile.cast).toBe(2);
    expect(run.profile.evidence["defile.cast"].status).toBe("documented");
    expect(
      createRoster(run).filter((actor) => actor.control === "player"),
    ).toHaveLength(1);
  });

  it("provides every authored target case and deterministic rosters", () => {
    const bases = [
      "before-standard",
      "before-tight",
      "after-standard",
      "after-tight",
      "spirits-moving",
      "spirits-settled",
      "frostmourne-return",
    ];
    for (const base of bases) {
      for (const target of ["you", "neighbor"]) {
        const run = makeRun(`${base}-${target}`, 19);
        expect(validateRun(run), run.scenario.variantId).toEqual([]);
        expect(createRoster(run)).toEqual(createRoster(run));
      }
    }
  });

  it("rejects missing provenance and impossible event references", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    delete run.profile.evidence["defile.radius"];
    expect(validateRun(run)).toContain("Missing evidence: defile.radius");
    run.scenario.events.push({
      id: "invalid",
      at: 1,
      checkpointId: "missing",
      kind: "pickup",
      actorId: "absent",
    });
    expect(validateRun(run)).toContain("Unknown checkpoint: missing");
    expect(validateRun(run)).toContain("Unknown actor: absent");
  });

  it("rejects duplicate IDs and invalid geometry", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    run.scenario.events[1]!.id = run.scenario.events[0]!.id;
    run.profile.arenaRadius = Number.NaN;
    run.profile.actorRadius = 0;
    expect(validateRun(run)).toEqual(
      expect.arrayContaining([
        "Duplicate event ID: defile",
        "Invalid geometry: arenaRadius",
        "Invalid geometry: actorRadius",
      ]),
    );
  });

  it("rejects reveal after resolution, unsupported families, endpoint overflow, and profile mismatch", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    run.profile.defile.revealDelay = 3;
    run.scenario.family = "other" as never;
    run.scenario.events[0]!.at = run.scenario.duration + 1;
    run.scenario.profileId = "missing";
    expect(validateRun(run)).toEqual(
      expect.arrayContaining([
        "Defile reveal occurs after resolution",
        "Unsupported family: other",
        "Event past endpoint: defile",
        "Profile mismatch: missing",
      ]),
    );
  });

  it("enforces the event limit and forbids player-controlled passengers", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    const pickup = run.scenario.events.find((event) => event.kind === "pickup");
    if (!pickup || pickup.kind !== "pickup")
      throw new Error("fixture lacks pickup");
    pickup.actorId = "you";
    run.scenario.events = Array.from({ length: 2001 }, (_, index) => ({
      ...pickup,
      id: `event-${index}`,
    }));
    expect(validateRun(run)).toEqual(
      expect.arrayContaining([
        "Too many events: 2001",
        "Player-controlled passenger: you",
      ]),
    );
  });

  it("throws for unknown variants", () => {
    expect(() => makeRun("unknown", 1)).toThrowError(
      "Unknown scenario variant: unknown",
    );
  });

  it("reports missing profiles and incomplete evidence without throwing", () => {
    const missing = structuredClone(
      makeRun("before-standard-you", 7),
    ) as Partial<ReturnType<typeof makeRun>>;
    delete missing.profile;
    expect(validateRun(missing as ReturnType<typeof makeRun>)).toEqual([
      "Missing profile",
    ]);

    const malformed = structuredClone(makeRun("before-standard-you", 7));
    malformed.profile.evidence["defile.cast"] = {
      status: "verified" as never,
      unit: "",
      source: "",
    };
    expect(validateRun(malformed)).toEqual(
      expect.arrayContaining([
        "Invalid evidence status: defile.cast",
        "Missing evidence unit: defile.cast",
        "Missing evidence source: defile.cast",
      ]),
    );
  });

  it("starts the settled soaker at the intercept anchor", () => {
    const run = makeRun("spirits-settled-you", 19);
    const soaker = createRoster(run).find((actor) => actor.id === "soaker");
    expect(soaker).toMatchObject({ x: 0, y: 9 });
  });

  it("returns independent authored definitions for every run", () => {
    const changed = makeRun("spirits-moving-you", 19);
    changed.profile.defile.cast = 99;
    changed.scenario.strategy.start.x = 99;
    changed.scenario.strategy.finish.y = 99;
    changed.scenario.strategy.spiritOrigin.x = 99;
    changed.scenario.strategy.soak.y = 99;
    changed.scenario.initialSpirits!.origin.y = 99;

    const fresh = makeRun("spirits-moving-you", 19);
    expect(fresh.profile.defile.cast).toBe(2);
    expect(fresh.scenario.strategy).toMatchObject({
      start: { x: 0, y: -22 },
      finish: { x: 0, y: 22 },
      spiritOrigin: { x: 0, y: -28 },
      soak: { x: 0, y: 9 },
    });
    expect(fresh.scenario.initialSpirits).toEqual({
      origin: { x: 0, y: -28 },
      firstBirthAt: -24,
    });
  });

  it("isolates the Frostmourne spirit-wave origin between runs", () => {
    const changed = makeRun("frostmourne-return-you", 19);
    const changedWave = changed.scenario.events.find(
      (event) => event.kind === "spirit-wave",
    );
    if (!changedWave || changedWave.kind !== "spirit-wave")
      throw new Error("fixture lacks spirit wave");
    changedWave.origin.x = 99;

    const fresh = makeRun("frostmourne-return-you", 19);
    const freshWave = fresh.scenario.events.find(
      (event) => event.kind === "spirit-wave",
    );
    expect(freshWave).toMatchObject({ origin: { x: 0, y: -28 } });
  });

  it("rejects incomplete profile numbers, inconsistent units, and invalid timeline metadata", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    run.profile.defile.tick = 0;
    delete (run.profile.defile as Partial<typeof run.profile.defile>).cast;
    run.profile.spirits.speed = Number.NaN;
    run.profile.evidence["defile.tick"].unit = "bananas";
    run.scenario.events[0]!.at = -1;
    run.scenario.checkpoints.push({
      id: "start",
      at: Number.POSITIVE_INFINITY,
    });
    expect(validateRun(run)).toEqual(
      expect.arrayContaining([
        "Invalid profile value: defile.tick",
        "Missing profile value: defile.cast",
        "Invalid profile value: spirits.speed",
        "Invalid evidence unit: defile.tick",
        "Invalid event time: defile",
        "Duplicate checkpoint ID: start",
        "Invalid checkpoint time: start",
      ]),
    );
  });

  it("reports a missing required profile subgroup without throwing", () => {
    const run = structuredClone(makeRun("before-standard-you", 7));
    delete (run.profile as Partial<typeof run.profile>).defile;
    expect(validateRun(run)).toContain("Missing profile group: defile");
  });
});

it("assigns the complete role roster with valid shipped class portraits", () => {
  const roster = createRoster(makeRun("before-standard-you", 7));
  expect(
    Object.fromEntries(
      ["tank", "soaker", "healer", "melee", "ranged"].map((role) => [
        role,
        roster.filter((actor) => actor.role === role).length,
      ]),
    ),
  ).toEqual({ tank: 1, soaker: 1, healer: 5, melee: 10, ranged: 8 });
  expect(roster.find((actor) => actor.control === "player")).toMatchObject({
    id: "you",
    role: "melee",
  });
  for (const actor of roster) {
    expect(actor.classIcon).toMatch(
      /^\/raid-trainer\/art\/classes\/[a-z]+\.jpg$/,
    );
    expect(existsSync(`public${actor.classIcon}`), actor.classIcon).toBe(true);
  }
});

it("versions the revised support calibration and validates its independent intercept bound", () => {
  const run = makeRun("spirits-settled-neighbor", 18);
  expect(run.profile.revision).toBe(2);
  expect(run.scenario.revision).toBe(2);
  expect(makeRun("before-standard-you", 7).scenario.revision).toBe(1);
  expect(run.scenario.strategy.soakInterceptRadius).toBe(4);
  expect(run.scenario.strategy.routeHalfWidth).toBe(2.5);
  expect(run.profile.evidence["strategy.soakInterceptRadius"]).toMatchObject({
    status: "teaching",
    unit: "yards",
  });
  run.scenario.strategy.soakInterceptRadius = NaN;
  expect(validateRun(run)).toContain(
    "Invalid geometry: strategy.soakInterceptRadius",
  );
  delete run.profile.evidence["strategy.soakInterceptRadius"];
  expect(validateRun(run)).toContain(
    "Missing evidence: strategy.soakInterceptRadius",
  );
});

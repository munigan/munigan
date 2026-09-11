import { recordedReview } from "../../../tests/support/raid-review";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PullResults, ReplayReview } from "./GameReview";
import { makeRun } from "./scenario-content";
import { advanceAttempt, createAttempt } from "./scenario-runtime";
import { createRecording, recordStep } from "./scenario-recording";
import { readAttempt } from "./scenario-view";
import type { TrainerController } from "./use-trainer";
import type { Attempt, WorldEvent } from "./scenario-model";
afterEach(cleanup);
function controller(attempt: Attempt) {
  const recording = createRecording();
  recordStep(recording, attempt);
  return {
    view: { ...readAttempt(attempt), attempt: 1 },
    run: attempt.run,
    recording,
    reviewState: readAttempt(attempt),
    reviewEvent: undefined,
    setArenaOptions: vi.fn(),
    seekEvent: vi.fn(),
    seekTime: vi.fn(),
    openReplay: vi.fn(),
    practiceCast: vi.fn(),
    toggleReplay: vi.fn(),
    setSpeed: vi.fn(),
    toggleReplaySound: vi.fn(),
    start: vi.fn(),
    newVariation: vi.fn(),
    replayPlaying: false,
    replaySpeed: 1,
    replayAudible: false,
  } as unknown as TrainerController;
}
function spiritMiss() {
  const attempt = createAttempt(makeRun("spirits-moving-you", 41));
  attempt.world.status = "complete";
  attempt.world.elapsed = 35;
  const event: WorldEvent = {
    id: "explosion:1",
    at: 12,
    kind: "explosion",
    sourceId: "spirit-1",
    mechanic: "vile-spirits",
    actorIds: ["you"],
    position: { x: 0, y: 0 },
    checkpointId: "start",
    amount: 1,
    protectedActorIds: [],
    obligations: [],
  };
  attempt.world.events.push(event);
  attempt.findings.push({
    id: "miss-1",
    eventId: event.id,
    at: 12,
    actorId: "you",
    mechanic: "vile-spirits",
    code: "exposure",
    severity: "miss",
    detail: "you took spirit burst damage",
  });
  return attempt;
}
it("separates clean personal Defile and supporting exposure with same-situation retry primary", () => {
  const attempt = spiritMiss(),
    t = controller(attempt);
  render(<PullResults trainer={t} run={attempt.run} tryTimers={vi.fn()} />);
  expect(
    within(screen.getByLabelText("Focus findings")).getByText(
      /No personal Defile ticks/,
    ),
  ).toBeVisible();
  expect(
    within(screen.getByLabelText("Supporting findings")).getByText(
      /1 personal · 0 raid spirit burst hits/,
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(
      /survived|six|6 personal|Your positioning kept the raid clear/,
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Try Timers only" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Retry same situation/ }));
  expect(t.start).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review first mistake" }));
  expect(t.openReplay).toHaveBeenCalledWith(10, attempt.world.events.at(-1)!);
  fireEvent.click(screen.getByRole("button", { name: "New variation" }));
  expect(t.newVariation).toHaveBeenCalled();
});
it("reviews a supporting explosion by immutable ID without personal Defile damage", () => {
  const attempt = spiritMiss(),
    t = controller(attempt);
  t.reviewEvent = structuredClone(attempt.world.events.at(-1)!);
  render(<ReplayReview trainer={t} run={attempt.run} />);
  expect(screen.getByText(/00:12.0 · First missed moment/)).toBeVisible();
  expect(screen.getByText("0 → 1")).toBeVisible();
  const marker = screen.getByRole("button", {
    name: /00:12.0 Vile Spirit explosion/,
  });
  expect(marker).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(marker);
  expect(t.seekEvent).toHaveBeenCalledWith(attempt.world.events.at(-1)!);
  fireEvent.click(screen.getByRole("button", { name: "Practice this moment" }));
  expect(t.practiceCast).toHaveBeenCalledWith("start");
});
it("keeps approved clean replay transport and supports speeds, seeks and path toggles", () => {
  const attempt = createAttempt(makeRun("before-standard-you", 41));
  attempt.world.status = "complete";
  attempt.world.elapsed = 27;
  const t = controller(attempt);
  render(<ReplayReview trainer={t} run={attempt.run} />);
  expect(
    screen.getByRole("heading", { name: /No positioning\s+misses/ }),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Replay controls" })).getByRole(
      "button",
      { name: /Replay again/ },
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "2×" }));
  expect(t.setSpeed).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole("button", { name: "Back one second" }));
  expect(t.seekTime).toHaveBeenCalledWith(26);
  fireEvent.click(screen.getByRole("checkbox", { name: /Your path/ }));
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ showTrail: false }),
  );
});
it("shows actual end reason for recording interruptions", () => {
  const attempt = createAttempt(makeRun("before-standard-you", 41));
  attempt.world.status = "failed";
  attempt.world.endReason = "recording-limit";
  render(
    <PullResults
      trainer={controller(attempt)}
      run={attempt.run}
      tryTimers={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: /Recording\s+interrupted/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Review first mistake" }),
  ).not.toBeInTheDocument();
});
it("matches cast review against pool event source IDs", () => {
  const attempt = createAttempt(makeRun("before-standard-you", 41));
  attempt.world.status = "running";
  advanceAttempt(attempt, 12, { x: 0, y: 0 });
  const t = controller(attempt);
  render(<PullResults trainer={t} run={attempt.run} tryTimers={vi.fn()} />);
  expect(
    within(screen.getByLabelText("Cast review")).queryByText("Clean"),
  ).not.toBeInTheDocument();
});

it("does not claim personal recovery when only a teammate had exposure", () => {
  const attempt = spiritMiss();
  attempt.world.events.at(-1)!.actorIds = ["raid-01"];
  attempt.findings[0].actorId = "raid-01";
  render(
    <PullResults
      trainer={controller(attempt)}
      run={attempt.run}
      tryTimers={vi.fn()}
    />,
  );
  expect(
    screen.queryByText(/You recovered into clear ground/),
  ).not.toBeInTheDocument();
});

it("marks a zero-tick route-overlapping cast imperfect and reviews its pool finding", () => {
  const { attempt } = recordedReview("route");
  expect(attempt.world.status).toBe("complete");
  expect(attempt.world.pools[0]).toMatchObject({
    x: 7.052543960320716,
    y: 14.976268764504812,
  });
  expect(attempt.findings.filter((f) => f.severity === "miss")).toMatchObject([
    { id: "event-3:you:route-overlap", at: 10, code: "route-overlap" },
  ]);
  expect(attempt.world.events.filter((e) => e.kind === "damage")).toHaveLength(
    0,
  );
  const t = controller(attempt);
  render(<PullResults trainer={t} run={attempt.run} tryTimers={vi.fn()} />);
  const row = within(screen.getByLabelText("Cast review")).getByRole("button", {
    name: /Defile 1/,
  });
  expect(row).not.toHaveTextContent("Clean");
  expect(row.querySelector(".is-clean")).toBeNull();
  expect(row).toHaveTextContent(/pool overlapped the planned route/);
  expect(row).toHaveTextContent("0 ticks");
  fireEvent.click(row);
  expect(t.openReplay).toHaveBeenCalledWith(
    8,
    expect.objectContaining({ id: "event-3" }),
  );
});

it("keeps a clean Defile cast clean when only supporting mechanics have misses", () => {
  const { attempt } = recordedReview("supporting");
  expect(attempt.world.status).toBe("complete");
  expect(attempt.findings.some((f) => f.severity === "miss")).toBe(true);
  expect(
    attempt.findings.filter(
      (f) => f.mechanic === "defile" && f.severity === "miss",
    ),
  ).toHaveLength(0);
  render(
    <PullResults
      trainer={controller(attempt)}
      run={attempt.run}
      tryTimers={vi.fn()}
    />,
  );
  const row = within(screen.getByLabelText("Cast review")).getByRole("button", {
    name: /Defile 1/,
  });
  expect(row).toHaveTextContent("Clean");
  expect(row.querySelector(".is-clean")).not.toBeNull();
});

it("follows the recorded neighbor target for cast, reveal, pool and victim damage selections", () => {
  const { attempt, recording } = recordedReview("neighbor");
  expect(attempt.world.status).toBe("complete");
  expect(attempt.world.casts[0].targetId).toBe("raid-07");
  const damage = recording.events.find((e) => e.kind === "damage")!;
  expect(damage.actorIds).toEqual(["you"]);
  const t = controller(attempt);
  t.recording = recording;
  t.reviewEvent = damage;
  const { rerender } = render(<ReplayReview trainer={t} run={attempt.run} />);
  const expected = recording.frames
    .filter((f) => f.world.elapsed >= 8 && f.world.elapsed <= 10)
    .map((f) => {
      const a = f.world.actors.find((a) => a.id === "raid-07")!;
      return { x: a.x, y: a.y };
    });
  expect(expected.at(-1)).toEqual({
    x: 9.981063552846756,
    y: 8.50522676937099,
  });
  expect(expected[0]).not.toEqual(expected.at(-1));
  for (const kind of ["cast", "target", "pool", "damage"]) {
    const event = recording.events.find((e) => e.kind === kind)!;
    fireEvent.change(screen.getByRole("combobox", { name: "Recorded event" }), {
      target: { value: event.id },
    });
    expect(t.setArenaOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordedTrail: expected }),
    );
    expect(
      screen.getByRole("checkbox", { name: /raid-07.*path/ }),
    ).toBeChecked();
  }
  fireEvent.click(screen.getByRole("checkbox", { name: /raid-07.*path/ }));
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ showTrail: false }),
  );
  const pickup = recording.events.find((e) => e.kind === "pickup")!;
  fireEvent.change(screen.getByRole("combobox", { name: "Recorded event" }), {
    target: { value: pickup.id },
  });
  expect(
    screen.getByRole("checkbox", {
      name: new RegExp(pickup.actorIds[0] + ".*path"),
    }),
  ).not.toBeChecked();
  fireEvent.change(screen.getByRole("combobox", { name: "Recorded event" }), {
    target: { value: damage.id },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /raid-07.*path/ }));
  t.reviewState = {
    ...t.reviewState!,
    world: { ...t.reviewState!.world, elapsed: 9 },
  };
  rerender(<ReplayReview trainer={t} run={attempt.run} />);
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      showTrail: true,
      recordedTrail: expected.slice(
        0,
        recording.frames.filter(
          (f) => f.world.elapsed >= 8 && f.world.elapsed <= 9,
        ).length,
      ),
    }),
  );
});

it("labels and extracts the recorded player path for a player-target cast", () => {
  const { attempt, recording } = recordedReview("route");
  const t = controller(attempt);
  t.recording = recording;
  t.reviewEvent = recording.events.find((e) => e.kind === "pool");
  render(<ReplayReview trainer={t} run={attempt.run} />);
  expect(screen.getByRole("checkbox", { name: /Your path/ })).toBeChecked();
  const expected = recording.frames
    .filter((f) => f.world.elapsed >= 8 && f.world.elapsed <= 10)
    .map((f) => {
      const a = f.world.actors.find((a) => a.id === "you")!;
      return { x: a.x, y: a.y };
    });
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ recordedTrail: expected }),
  );
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PullResults, ReplayReview } from "./GameReview";
import { lichKingDefile as encounter } from "./encounters";
import { advanceSession, createSession, snapshot } from "./simulation";
import type { TrainerController } from "./use-trainer";
import type { Snapshot } from "./model";

afterEach(cleanup);
function controller(state: Snapshot) {
  return {
    view: { state, attempt: 1 },
    reviewState: { ...state, elapsed: 12 },
    reviewEvent: structuredClone(
      state.events.find((event) => event.kind === "damage"),
    ),
    setArenaOptions: vi.fn(),
    seekEvent: vi.fn(),
    seekTime: vi.fn(),
    openReplay: vi.fn(),
    practiceCast: vi.fn(),
    toggleReplay: vi.fn(),
    setSpeed: vi.fn(),
    toggleReplaySound: vi.fn(),
    replayPlaying: false,
    replaySpeed: 1,
    replayAudible: false,
  } as unknown as TrainerController;
}
it("recognizes the first tick across copied replay snapshots and limits the path to the selected cast", () => {
  const session = createSession(encounter);
  session.status = "running";
  advanceSession(session, 18);
  const t = controller(snapshot(session));
  render(<ReplayReview trainer={t} encounter={encounter} />);
  expect(screen.getByText(/00:12.0 · First damage tick/)).toBeVisible();
  expect(screen.getByText("0 → 1")).toBeVisible();
  expect(screen.queryByText("Raid exposure")).not.toBeInTheDocument();
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      recordedTrail: session.trail.filter(
        (point) => point.at >= 8 && point.at <= 11,
      ),
      highlightedEvent: expect.objectContaining({
        label: "FIRST TICK",
        detail: "You were still inside.",
      }),
    }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /Your path/ }));
  expect(t.setArenaOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ showTrail: false }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Practice cast 1" }));
  expect(t.practiceCast).toHaveBeenCalledWith("defile-1");
});
it("presents platform overrun with raid exposure and a pool-growth review action", () => {
  const state = snapshot(createSession(encounter));
  state.status = "failed";
  state.elapsed = 28;
  state.stats = { casts: 2, personalHits: 0, raidHits: 24, growths: 24 };
  state.events = [
    {
      at: 12,
      kind: "damage",
      castId: "defile-1",
      text: "Raid hit",
      personalHits: 0,
      raidHits: 1,
      growth: 1,
    },
  ];
  const t = controller(state);
  render(<PullResults trainer={t} encounter={encounter} tryTimers={vi.fn()} />);
  expect(
    screen.getByRole("heading", { name: /The pool\s+took over\./ }),
  ).toBeVisible();
  expect(screen.getByText(/Check the raid’s return path/)).toBeVisible();
  expect(screen.queryByText(/You reached/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review pool growth" }));
  expect(t.openReplay).toHaveBeenCalledWith(10);
});
it("keeps clean replay free of a first-mistake action and stops on its last frame", () => {
  const state = snapshot(createSession(encounter));
  state.status = "complete";
  state.elapsed = 57;
  state.stats.casts = 3;
  const t = controller(state);
  t.reviewState = state;
  render(<ReplayReview trainer={t} encounter={encounter} />);
  expect(
    screen.getByRole("heading", { name: /No damage\s+events\./ }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /first mistake/ }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Replay controls" })).getByRole(
      "button",
      { name: /Replay again/ },
    ),
  ).toBeVisible();
});

import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTrainer, initialSound } from "./use-trainer";
import { makeRun } from "./scenario-content";
import type { RunSpec } from "./scenario-model";
import type { ScenarioSelection } from "./training-catalog";
import { prepareScenarioAssets } from "./arena-assets";
vi.mock("./render-scenario", () => ({ drawScenario: vi.fn() }));
vi.mock("./arena-assets", () => ({
  prepareScenarioAssets: vi.fn().mockResolvedValue(undefined),
}));
const audio = vi.hoisted(() => ({
  unlock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  play: vi.fn(),
}));
vi.mock("./audio-engine", () => ({
  TrainerAudio: class {
    configure() {}
    unlock() {
      return audio.unlock();
    }
    setActive() {}
    play(cue: string) {
      audio.play(cue);
    }
    stop() {}
    destroy() {}
  },
}));
let trainer: ReturnType<typeof useTrainer>;
let callback: FrameRequestCallback | undefined,
  now = 100;
function Fixture({
  run,
  selection,
}: {
  run: RunSpec;
  selection?: ScenarioSelection;
}) {
  const { canvasRef, ...controller } = useTrainer(
    run,
    { ...initialSound, enabled: false },
    undefined,
    false,
    selection,
  );
  useLayoutEffect(() => {
    trainer = { canvasRef, ...controller };
  });
  return (
    <section className="rt-game">
      <canvas tabIndex={0} ref={canvasRef} />
      <select aria-label="Control">
        <option>Choice</option>
      </select>
      <button>Control button</button>
    </section>
  );
}
function frame(ms: number) {
  now += ms;
  act(() => callback?.(now));
}
function advance(seconds: number) {
  for (let i = 0; i < seconds * 60; i++) frame(1000 / 60);
}
beforeEach(() => {
  now = 100;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb) => {
      callback = cb;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("records every event step and retries the same seed, roster and situation", () => {
  const run = makeRun("before-standard-you", 41);
  render(<Fixture run={run} />);
  const initial = structuredClone(trainer.view.world.actors);
  expect(trainer.recording.frames).toHaveLength(1);
  act(() => trainer.start());
  frame(16);
  advance(3.2);
  advance(12);
  expect(trainer.view.world.elapsed).toBeGreaterThan(11);
  expect(
    trainer.recording.events.some((event) => event.kind === "damage"),
  ).toBe(true);
  expect(
    trainer.recording.frames.some((frame) => frame.world.step === 660),
  ).toBe(true);
  act(() => trainer.start());
  expect(trainer.run.seed).toBe(41);
  expect(trainer.view.world.actors).toEqual(initial);
  expect(trainer.view.world.elapsed).toBe(0);
  expect(document.activeElement).toBe(trainer.canvasRef.current);
});
it("does not hijack control shortcuts, clears held movement on focus loss and preserves resume cancel", () => {
  render(<Fixture run={makeRun("before-standard-you", 41)} />);
  const select = screen.getByRole("combobox"),
    button = screen.getByRole("button");
  fireEvent.keyDown(select, { code: "KeyR" });
  fireEvent.keyDown(button, { code: "Space" });
  expect(trainer.view.world.status).toBe("ready");
  act(() => trainer.start());
  frame(16);
  advance(3.2);
  fireEvent.keyDown(trainer.canvasRef.current!, { code: "KeyD" });
  advance(0.2);
  fireEvent(window, new Event("blur"));
  expect(trainer.view.world.status).toBe("paused");
  const x = trainer.view.world.actors.find((actor) => actor.id === "you")!.x;
  act(() => trainer.pause());
  act(() => trainer.cancelCountdown());
  expect(trainer.view.world.status).toBe("paused");
  act(() => trainer.pause());
  advance(4);
  expect(trainer.view.world.actors.find((actor) => actor.id === "you")!.x).toBe(
    x,
  );
});
it("preloads new variations, retains Mixed intent and cancels a pending load", async () => {
  render(
    <Fixture run={makeRun("before-standard-you", 41)} selection="mixed" />,
  );
  let resolve!: () => void;
  vi.mocked(prepareScenarioAssets).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = trainer.newVariation();
  });
  expect(trainer.preparing).toBe(true);
  expect(trainer.run.scenario.family).toBe("before-valkyrs");
  act(() => trainer.cancelPreparation());
  await act(async () => {
    resolve();
    await pending;
  });
  expect(trainer.run.seed).toBe(41);
  await act(async () => {
    await trainer.newVariation();
  });
  expect(trainer.run.scenario.family).toBe("after-valkyrs");
  expect(trainer.run.seed).not.toBe(41);
  expect(trainer.view.world.status).toBe("countdown");
});
it("practice fallback replaces recording and keeps the same retry identity", () => {
  render(<Fixture run={makeRun("before-standard-you", 41)} />);
  trainer.recording.checkpoints.start.profileRevision = -1;
  const previous = trainer.recording;
  act(() => trainer.practiceCast("start"));
  expect(trainer.recording).not.toBe(previous);
  expect(trainer.run.seed).toBe(41);
  expect(trainer.practiceNotice).toMatch(/checkpoint is unavailable/);
  expect(trainer.view.world.status).toBe("countdown");
});

it("does not play a delayed countdown after cancellation and preserves explicit family intent", async () => {
  let resolve!: () => void;
  audio.unlock.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  render(<Fixture run={makeRun("before-standard-you", 41)} />);
  act(() => trainer.start());
  act(() => trainer.cancelCountdown());
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  expect(audio.play).not.toHaveBeenCalled();
  await act(async () => {
    await trainer.newVariation();
  });
  expect(trainer.run.scenario.family).toBe("before-valkyrs");
  expect(trainer.run.scenario.id).not.toBe("before-standard-you");
  expect(document.activeElement).toBe(trainer.canvasRef.current);
});
it("applies touch movement and releases it without relying on keyboard focus", () => {
  render(<Fixture run={makeRun("before-standard-you", 41)} />);
  act(() => trainer.start());
  frame(16);
  advance(3.2);
  const startX = trainer.view.world.actors.find(
    (actor) => actor.id === "you",
  )!.x;
  act(() => trainer.touch("KeyD", true));
  advance(0.5);
  const movedX = trainer.view.world.actors.find(
    (actor) => actor.id === "you",
  )!.x;
  expect(movedX - startX).toBeCloseTo(3.5, 0);
  act(() => trainer.touch("KeyD", false));
  advance(0.2);
  expect(
    trainer.view.world.actors.find((actor) => actor.id === "you")!.x,
  ).toBeCloseTo(movedX, 0);
});

it("clears replay-only annotations before returning to a live retry", async () => {
  const { drawScenario } = await import("./render-scenario");
  render(<Fixture run={makeRun("before-standard-you", 41)} />);
  act(() =>
    trainer.setArenaOptions({
      recordedTrail: [{ x: 5, y: 5 }],
      highlightedLabel: "Prior event",
    }),
  );
  act(() => trainer.start());
  frame(16);
  expect(vi.mocked(drawScenario).mock.lastCall?.[3]).toEqual(
    expect.objectContaining({ recordedTrail: [], highlightedLabel: undefined }),
  );
});

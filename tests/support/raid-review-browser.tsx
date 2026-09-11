import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ReplayReview,
  PullResults,
} from "../../src/features/raid-trainer/GameReview";
import { recordedReview } from "./raid-review";
import {
  readAttempt,
  readWorldView,
} from "../../src/features/raid-trainer/scenario-view";
import {
  frameIndexForEvent,
  frameView,
} from "../../src/features/raid-trainer/scenario-recording";
import { drawScenario } from "../../src/features/raid-trainer/render-scenario";
import { prepareScenarioAssets } from "../../src/features/raid-trainer/arena-assets";
import type { ScenarioRenderOptions } from "../../src/features/raid-trainer/scenario-model";
import type { TrainerController } from "../../src/features/raid-trainer/use-trainer";

async function mount() {
  const name = new URLSearchParams(location.search).get("case") as
    "route" | "neighbor";
  const { attempt, recording } = recordedReview(name);
  await prepareScenarioAssets(attempt.run);
  await document.fonts.ready;
  const final = readAttempt(attempt);
  function Fixture() {
    const [index, setIndex] = useState(recording.frames.length - 1);
    const [results, setResults] = useState(name === "route");
    const [options, setOptions] = useState<ScenarioRenderOptions>({});
    const canvas = useRef<HTMLCanvasElement>(null);
    const setArenaOptions = useCallback(
      (next: ScenarioRenderOptions) => setOptions(next),
      [],
    );
    const reviewState = useMemo(
      () =>
        readWorldView(
          attempt.run,
          frameView(recording, index),
          recording.findings,
        ),
      [index],
    );
    const t = {
      view: { ...final, attempt: 1 },
      recording,
      run: attempt.run,
      reviewState,
      reviewEvent: recording.events.find((e) => e.kind === "pool"),
      setArenaOptions,
      seekEvent: (event) => setIndex(frameIndexForEvent(recording, event.id)),
      seekTime: (time) =>
        setIndex(
          recording.frames.findLastIndex((f) => f.world.elapsed <= time),
        ),
      openReplay: () => setResults(false),
      replayPlaying: false,
      replaySpeed: 1,
      replayAudible: false,
    } as TrainerController;
    useEffect(() => {
      if (canvas.current)
        drawScenario(
          canvas.current,
          attempt.run,
          results ? final : reviewState,
          options,
        );
    }, [options, reviewState, results]);
    return (
      <main className={`rt-game ${results ? "is-result" : "is-replay"}`}>
        <div className="rt-arena-scene">
          <canvas ref={canvas} />
        </div>
        {results ? (
          <PullResults trainer={t} run={attempt.run} tryTimers={() => {}} />
        ) : (
          <ReplayReview trainer={t} run={attempt.run} />
        )}
      </main>
    );
  }
  createRoot(document.getElementById("root")!).render(<Fixture />);
}
void mount();

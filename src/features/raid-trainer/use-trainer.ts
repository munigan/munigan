"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RunSpec,
  View,
  WorldEvent,
  ScenarioRenderOptions,
  Mode,
} from "./scenario-model";
import { createAttempt, advanceAttempt } from "./scenario-runtime";
import { readAttempt, readWorldView } from "./scenario-view";
import {
  createRecording,
  recordStep,
  frameView,
  nextRun,
} from "./scenario-recording";
import { drawScenario } from "./render-scenario";
import { prepareScenarioAssets } from "./arena-assets";
import type { ScenarioSelection } from "./training-catalog";
import { advanceReplay, eventReplayTime } from "./replay";
import { restorePractice } from "./practice-state";
import { TrainerAudio, type AudioSettings } from "./audio-engine";
import { scenarioAudioCues, type AudioCue } from "./audio-cues";

export const initialSound: AudioSettings = {
  enabled: true,
  volume: 0.55,
  voice: true,
  ambience: true,
};
export function useTrainer(
  run: RunSpec,
  initialPreferences = initialSound,
  onPreferencesChange?: (settings: AudioSettings) => void,
  autoStart = false,
  selection: ScenarioSelection = run.scenario.family,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => {
    const s = createAttempt(run);
    if (autoStart) s.world.status = "countdown";
    return s;
  });
  const [initialRecording] = useState(() => {
    const result = createRecording();
    recordStep(result, initial);
    return result;
  });
  const session = useRef(initial),
    keys = useRef(new Set<string>()),
    recording = useRef(initialRecording);
  const [publishedRecording, setPublishedRecording] =
    useState(initialRecording);
  const [currentRun, setCurrentRun] = useState(initial.run);
  const variation = useRef(0),
    preparation = useRef(0);
  const [preparing, setPreparing] = useState(false),
    [preparationError, setPreparationError] = useState("");
  const [practiceNotice, setPracticeNotice] = useState("");
  const replay = useRef<View | null>(null),
    replayPosition = useRef(0),
    playing = useRef(false),
    speed = useRef(1),
    replaySound = useRef(false);
  const attempt = useRef(1),
    pullIn = useRef(autoStart ? 3 : 0),
    countdownKind = useRef<"start" | "resume" | "practice">("start");
  const options = useRef<ScenarioRenderOptions>({
    showTrail: true,
    showGrowth: true,
  });
  const sound = useRef<TrainerAudio | null>(null),
    operation = useRef(0),
    settings = useRef(initialPreferences);
  const [audioSettings, setAudioSettings] = useState(initialPreferences),
    [audioUnavailable, setAudioUnavailable] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<WorldEvent | undefined>();
  const [reviewState, setReviewState] = useState<View | null>(null),
    [replayPlaying, setReplayPlaying] = useState(false),
    [replaySpeed, setReplaySpeed] = useState(1),
    [replayAudible, setReplayAudible] = useState(false);
  const [pauseReason, setPauseReason] = useState<"manual" | "focus">("manual");
  const [view, setView] = useState(() => ({
    ...readAttempt(initial),
    attempt: 1,
    pullIn: autoStart ? 3 : 0,
    countdownKind: "start" as "start" | "resume" | "practice",
  }));
  const publish = useCallback(() => {
    setPublishedRecording(recording.current);
    setView({
      ...readAttempt(session.current),
      attempt: attempt.current,
      pullIn: pullIn.current,
      countdownKind: countdownKind.current,
    });
  }, []);
  const enableAudio = useCallback(async () => {
    try {
      sound.current ??= new TrainerAudio();
      sound.current.configure(settings.current);
      await sound.current.unlock();
      setAudioUnavailable(false);
    } catch {
      setAudioUnavailable(true);
    }
  }, []);
  const configureSound = useCallback(
    (update: Partial<AudioSettings>) => {
      operation.current++;
      settings.current = { ...settings.current, ...update };
      setAudioSettings(settings.current);
      onPreferencesChange?.(settings.current);
      sound.current?.configure(settings.current);
      if (settings.current.enabled) void enableAudio();
      else sound.current?.stop();
    },
    [enableAudio, onPreferencesChange],
  );
  const cueCountdown = useCallback(() => {
    const id = ++operation.current;
    void enableAudio().then(() => {
      if (
        id === operation.current &&
        session.current.world.status === "countdown"
      ) {
        sound.current?.setActive(true);
        sound.current?.play(
          `count-${Math.max(1, Math.ceil(pullIn.current))}` as AudioCue,
        );
      }
    });
  }, [enableAudio]);
  const closeReplay = useCallback(() => {
    replay.current = null;
    playing.current = false;
    setReviewState(null);
    setReviewEvent(undefined);
    setReplayPlaying(false);
    sound.current?.stop();
    options.current.highlightedEvent = null;
    options.current.recordedTrail = [];
    options.current.highlightedLabel = undefined;
    options.current.highlightedDetail = undefined;
  }, []);
  const start = useCallback(() => {
    preparation.current++;
    setPreparing(false);
    setPreparationError("");
    setPracticeNotice("");
    if (session.current.world.status !== "ready") attempt.current++;
    sound.current?.stop();
    closeReplay();
    session.current = createAttempt(session.current.run);
    session.current.world.status = "countdown";
    recording.current = createRecording();
    recordStep(recording.current, session.current);
    pullIn.current = 3;
    countdownKind.current = "start";
    keys.current.clear();
    cueCountdown();
    publish();
    canvasRef.current?.focus({ preventScroll: true });
  }, [closeReplay, cueCountdown, publish]);
  const newVariation = useCallback(async () => {
    const id = ++preparation.current;
    operation.current++;
    sound.current?.stop();
    keys.current.clear();
    if (["running", "countdown"].includes(session.current.world.status))
      session.current.world.status = "paused";
    closeReplay();
    setPreparing(true);
    setPreparationError("");
    publish();
    try {
      const next = nextRun(
        session.current.run,
        selection,
        variation.current + 1,
      );
      await prepareScenarioAssets(next);
      if (id !== preparation.current) return;
      session.current = createAttempt(next);
      setCurrentRun(session.current.run);
      variation.current++;
      attempt.current++;
      start();
    } catch {
      if (id === preparation.current)
        setPreparationError(
          "The next variation could not load. Retry or keep this situation.",
        );
    } finally {
      if (id === preparation.current) setPreparing(false);
    }
  }, [selection, closeReplay, publish, start]);
  const cancelPreparation = useCallback(() => {
    preparation.current++;
    setPreparing(false);
    setPreparationError("");
    canvasRef.current?.focus({ preventScroll: true });
  }, []);
  const setMode = useCallback(
    (mode: Mode) => {
      session.current.run = { ...session.current.run, mode };
      setCurrentRun(session.current.run);
      publish();
    },
    [publish],
  );
  const pause = useCallback(() => {
    operation.current++;
    keys.current.clear();
    const s = session.current.world;
    if (s.status === "running" || s.status === "countdown") {
      s.status = "paused";
      setPauseReason("manual");
      sound.current?.stop();
    } else if (s.status === "paused") {
      s.status = "countdown";
      countdownKind.current = "resume";
      pullIn.current = 3;
      cueCountdown();
      canvasRef.current?.focus({ preventScroll: true });
    }
    publish();
  }, [cueCountdown, publish]);
  const cancelCountdown = useCallback(() => {
    if (session.current.world.status !== "countdown") return;
    operation.current++;
    sound.current?.stop();
    keys.current.clear();
    if (countdownKind.current === "resume")
      session.current.world.status = "paused";
    else {
      session.current = createAttempt(session.current.run);
      recording.current = createRecording();
      recordStep(recording.current, session.current);
    }
    pullIn.current = 0;
    publish();
    if (session.current.world.status === "ready")
      canvasRef.current?.focus({ preventScroll: true });
  }, [publish]);
  const seekTime = useCallback((elapsed: number) => {
    if (
      !["failed", "complete"].includes(session.current.world.status) ||
      !recording.current.frames.length
    )
      return;
    const next = advanceReplay(
      recording.current.frames.map((frame) => frame.world),
      elapsed,
      0,
    );
    replay.current = readWorldView(
      session.current.run,
      frameView(recording.current, next.index),
      recording.current.findings.slice(
        0,
        recording.current.frames[next.index].findingCount,
      ),
    );
    replayPosition.current = next.elapsed;
    playing.current = false;
    setReplayPlaying(false);
    setReviewState(replay.current);
    sound.current?.stop();
  }, []);
  const seekEvent = useCallback(
    (event: WorldEvent) => seekTime(eventReplayTime(recording.current, event)),
    [seekTime],
  );
  const openReplay = useCallback(
    (elapsed = 0, event?: WorldEvent) => {
      setReviewEvent(event);
      replaySound.current = false;
      setReplayAudible(false);
      seekTime(elapsed);
      canvasRef.current?.focus({ preventScroll: true });
    },
    [seekTime],
  );
  const toggleReplay = useCallback(() => {
    if (!replay.current) {
      replaySound.current = false;
      setReplayAudible(false);
    }
    if (!["failed", "complete"].includes(session.current.world.status)) return;
    if (
      !replay.current ||
      replayPosition.current >=
        (recording.current.frames.at(-1)?.world.elapsed ?? 0)
    )
      seekTime(0);
    playing.current = !playing.current;
    setReplayPlaying(playing.current);
    if (!playing.current) sound.current?.stop();
  }, [seekTime]);
  const practiceCast = useCallback(
    (castId: string) => {
      preparation.current++;
      const restored = restorePractice(
        session.current.run,
        recording.current,
        castId,
      );
      closeReplay();
      attempt.current++;
      session.current = restored.attempt;
      recording.current = restored.recording;
      setCurrentRun(restored.attempt.run);
      setPracticeNotice(
        restored.fallback
          ? "This checkpoint is unavailable. Retrying the same situation."
          : "",
      );
      countdownKind.current = "practice";
      pullIn.current = 3;
      keys.current.clear();
      cueCountdown();
      publish();
      canvasRef.current?.focus({ preventScroll: true });
    },
    [closeReplay, cueCountdown, publish],
  );
  const setSpeed = useCallback((value: number) => {
    speed.current = value;
    setReplaySpeed(value);
  }, []);
  const toggleReplaySound = useCallback(() => {
    replaySound.current = !replaySound.current;
    setReplayAudible(replaySound.current);
    if (replaySound.current) {
      if (!settings.current.enabled) configureSound({ enabled: true });
      else void enableAudio();
    } else sound.current?.stop();
  }, [configureSound, enableAudio]);
  const setArenaOptions = useCallback((update: ScenarioRenderOptions) => {
    options.current = { ...options.current, ...update };
  }, []);
  const toggleSound = useCallback(
    () => configureSound({ enabled: !settings.current.enabled }),
    [configureSound],
  );
  const previewSound = useCallback(() => {
    const id = ++operation.current;
    void enableAudio().then(() => {
      if (id === operation.current) sound.current?.play("count-3");
    });
  }, [enableAudio]);
  const continueWithoutSound = useCallback(() => {
    configureSound({ enabled: false });
    setAudioUnavailable(false);
  }, [configureSound]);
  const touch = useCallback((code: string, held: boolean) => {
    if (held) keys.current.add(code);
    else keys.current.delete(code);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0,
      previous = 0,
      lastPublished = -1;
    let previousAudio = readAttempt(session.current);
    const movement = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ];
    const clear = () => keys.current.clear();
    const loseFocus = () => {
      operation.current++;
      sound.current?.stop();
      clear();
      playing.current = false;
      setReplayPlaying(false);
      if (["running", "countdown"].includes(session.current.world.status)) {
        session.current.world.status = "paused";
        setPauseReason("focus");
        publish();
      }
    };
    const visibility = () => {
      if (document.hidden) loseFocus();
    };
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !canvas.closest(".rt-game")?.contains(target) ||
        target.matches(
          "input, select, textarea, button, a, [role=combobox], [role=option]",
        ) ||
        target.isContentEditable ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (
        movement.includes(event.code) &&
        !target.closest("dialog, [role=dialog]")
      ) {
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        keys.current.add(event.code);
      }
      if (event.code === "Space" && !event.repeat && target === canvas) {
        event.preventDefault();
        if (session.current.world.status === "ready") start();
        else if (["failed", "complete"].includes(session.current.world.status))
          toggleReplay();
        else pause();
      }
      if (
        event.code === "Enter" &&
        target === canvas &&
        session.current.world.status === "ready"
      ) {
        event.preventDefault();
        start();
      }
      if (
        event.code === "KeyR" &&
        !event.repeat &&
        target === canvas &&
        !target.closest("dialog, [role=dialog]")
      ) {
        event.preventDefault();
        start();
      }
      if (event.code === "Escape" && !target.closest("dialog, [role=dialog]")) {
        event.preventDefault();
        if (replay.current) closeReplay();
        else if (session.current.world.status === "countdown")
          cancelCountdown();
        else if (session.current.world.status === "running") pause();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const focus = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLElement &&
        !canvas.closest(".rt-game")?.contains(event.target)
      )
        loseFocus();
    };
    function render(now: number) {
      const delta = previous ? Math.min((now - previous) / 1000, 0.25) : 0;
      previous = now;
      const s = session.current.world;
      if (s.status === "countdown") {
        const old = Math.ceil(pullIn.current);
        pullIn.current = Math.max(0, pullIn.current - delta);
        const count = Math.ceil(pullIn.current);
        if (count > 0 && count !== old)
          sound.current?.play(`count-${count}` as AudioCue);
        if (!count) {
          s.status = "running";
          recordStep(recording.current, session.current);
          previousAudio = readAttempt(session.current);
        }
      } else {
        const held = (a: string, b: string) =>
          Number(keys.current.has(a) || keys.current.has(b));
        advanceAttempt(
          session.current,
          delta,
          {
            x: held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft"),
            y: held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp"),
          },
          (step) => recordStep(recording.current, step),
        );
      }

      sound.current?.setActive(
        !replay.current && (s.status === "running" || s.status === "countdown"),
      );
      const nextAudio = readAttempt(session.current);
      if (!replay.current && s.elapsed >= previousAudio.world.elapsed)
        for (const cue of scenarioAudioCues(previousAudio, nextAudio))
          sound.current?.play(cue);
      previousAudio = nextAudio;
      if (playing.current && recording.current.frames.length) {
        const before = replay.current;
        const next = advanceReplay(
          recording.current.frames.map((frame) => frame.world),
          replayPosition.current,
          delta * speed.current,
        );
        replayPosition.current = next.elapsed;
        replay.current = readWorldView(
          session.current.run,
          frameView(recording.current, next.index),
          recording.current.findings.slice(
            0,
            recording.current.frames[next.index].findingCount,
          ),
        );
        if (replaySound.current && before)
          for (const cue of scenarioAudioCues(before, replay.current))
            sound.current?.play(cue);
        if (next.ended || now - lastPublished > 90)
          setReviewState(replay.current);
        if (next.ended) {
          playing.current = false;
          setReplayPlaying(false);
        }
      }
      drawScenario(
        canvas!,
        session.current.run,
        replay.current ?? nextAudio,
        options.current,
      );
      if (now - lastPublished > 90) {
        publish();
        lastPublished = now;
      }
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", loseFocus);
    canvas.addEventListener("blur", clear);
    document.addEventListener("focusin", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", loseFocus);
      canvas.removeEventListener("blur", clear);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [publish, start, pause, cancelCountdown, closeReplay, toggleReplay]);
  useEffect(
    () => () => {
      operation.current++;
      preparation.current++;
      sound.current?.destroy();
      sound.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!autoStart) return;
    canvasRef.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(cueCountdown);
    return () => cancelAnimationFrame(frame);
  }, [autoStart, cueCountdown]);
  return {
    canvasRef,
    view,
    run: currentRun,
    recording: publishedRecording,
    setMode,
    newVariation,
    preparing,
    preparationError,
    cancelPreparation,
    practiceNotice,
    start,
    pause,
    pauseReason,
    cancelCountdown,
    openReplay,
    closeReplay,
    seekTime,
    seekEvent,
    reviewState,
    reviewEvent,
    replayPlaying,
    toggleReplay,
    replaySpeed,
    setSpeed,
    replayAudible,
    toggleReplaySound,
    practiceCast,
    setArenaOptions,
    audioSettings,
    audioUnavailable,
    continueWithoutSound,
    configureSound,
    previewSound,
    toggleSound,
    touch,
  };
}
export type TrainerController = Omit<
  ReturnType<typeof useTrainer>,
  "canvasRef"
>;

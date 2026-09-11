"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EncounterDefinition,
  Snapshot,
  TrainerEvent,
  TrainingMode,
} from "./model";
import {
  advanceSession,
  createSession,
  getTimers,
  snapshot,
} from "./simulation";
import { drawArena, type ArenaRenderOptions } from "./render-arena";
import { advanceReplay, eventReplayTime } from "./replay";
import { restorePractice } from "./practice-state";
import { TrainerAudio, type AudioSettings } from "./audio-engine";
import { audioCues, audioFrame, type AudioCue } from "./audio-cues";

export const initialSound: AudioSettings = {
  enabled: true,
  volume: 0.55,
  voice: true,
  ambience: true,
};
export function useTrainer(
  encounter: EncounterDefinition,
  mode: TrainingMode,
  initialPreferences = initialSound,
  onPreferencesChange?: (settings: AudioSettings) => void,
  autoStart = false,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => {
    const s = createSession(encounter);
    if (autoStart) s.status = "countdown";
    return s;
  });
  const session = useRef(initial),
    keys = useRef(new Set<string>()),
    history = useRef<Snapshot[]>([]);
  const replay = useRef<Snapshot | null>(null),
    replayPosition = useRef(0),
    playing = useRef(false),
    speed = useRef(1),
    replaySound = useRef(false);
  const attempt = useRef(1),
    pullIn = useRef(autoStart ? 3 : 0),
    countdownKind = useRef<"start" | "resume" | "practice">("start");
  const options = useRef<ArenaRenderOptions>({
    showTrail: true,
    showGrowth: true,
  });
  const sound = useRef<TrainerAudio | null>(null),
    operation = useRef(0),
    settings = useRef(initialPreferences);
  const [audioSettings, setAudioSettings] = useState(initialPreferences),
    [audioUnavailable, setAudioUnavailable] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<TrainerEvent | undefined>();
  const [reviewState, setReviewState] = useState<Snapshot | null>(null),
    [replayPlaying, setReplayPlaying] = useState(false),
    [replaySpeed, setReplaySpeed] = useState(1),
    [replayAudible, setReplayAudible] = useState(false);
  const [pauseReason, setPauseReason] = useState<"manual" | "focus">("manual");
  const [view, setView] = useState(() => ({
    state: snapshot(initial),
    timers: getTimers(initial),
    attempt: 1,
    pullIn: autoStart ? 3 : 0,
    countdownKind: "start" as "start" | "resume" | "practice",
  }));
  const publish = useCallback(
    () =>
      setView({
        state: snapshot(session.current),
        timers: getTimers(session.current),
        attempt: attempt.current,
        pullIn: pullIn.current,
        countdownKind: countdownKind.current,
      }),
    [],
  );
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
      if (id === operation.current && session.current.status === "countdown") {
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
  }, []);
  const start = useCallback(() => {
    if (session.current.status !== "ready") attempt.current++;
    sound.current?.stop();
    closeReplay();
    session.current = createSession(encounter, attempt.current);
    session.current.status = "countdown";
    pullIn.current = 3;
    countdownKind.current = "start";
    keys.current.clear();
    history.current = [];
    cueCountdown();
    publish();
    canvasRef.current?.focus({ preventScroll: true });
  }, [encounter, closeReplay, cueCountdown, publish]);
  const pause = useCallback(() => {
    operation.current++;
    keys.current.clear();
    const s = session.current;
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
    if (session.current.status !== "countdown") return;
    operation.current++;
    sound.current?.stop();
    keys.current.clear();
    if (countdownKind.current === "resume") session.current.status = "paused";
    else {
      session.current = createSession(encounter, session.current.seed);
      history.current = [];
    }
    pullIn.current = 0;
    publish();
  }, [encounter, publish]);
  const seekTime = useCallback((elapsed: number) => {
    if (
      !["failed", "complete"].includes(session.current.status) ||
      !history.current.length
    )
      return;
    const next = advanceReplay(history.current, elapsed, 0);
    replay.current = history.current[next.index];
    replayPosition.current = next.elapsed;
    playing.current = false;
    setReplayPlaying(false);
    setReviewState(replay.current);
    sound.current?.stop();
  }, []);
  const seekEvent = useCallback(
    (event: TrainerEvent) => seekTime(eventReplayTime(history.current, event)),
    [seekTime],
  );
  const openReplay = useCallback(
    (elapsed = 0, event?: TrainerEvent) => {
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
    if (!["failed", "complete"].includes(session.current.status)) return;
    if (
      !replay.current ||
      replayPosition.current >= (history.current.at(-1)?.elapsed ?? 0)
    )
      seekTime(0);
    playing.current = !playing.current;
    setReplayPlaying(playing.current);
    if (!playing.current) sound.current?.stop();
  }, [seekTime]);
  const practiceCast = useCallback(
    (castId: string) => {
      const restored = restorePractice(
        encounter,
        history.current,
        castId,
        session.current.seed,
      );
      if (!restored) return;
      closeReplay();
      attempt.current++;
      session.current = restored.session;
      history.current = restored.history;
      countdownKind.current = "practice";
      pullIn.current = 3;
      keys.current.clear();
      cueCountdown();
      publish();
      canvasRef.current?.focus({ preventScroll: true });
    },
    [encounter, closeReplay, cueCountdown, publish],
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
  const setArenaOptions = useCallback((update: ArenaRenderOptions) => {
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
    let previousAudio = audioFrame(session.current);
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
      if (["running", "countdown"].includes(session.current.status)) {
        session.current.status = "paused";
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
        target.matches("input, select, textarea") ||
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
        if (session.current.status === "ready") start();
        else if (["failed", "complete"].includes(session.current.status))
          toggleReplay();
        else pause();
      }
      if (
        event.code === "Enter" &&
        target === canvas &&
        session.current.status === "ready"
      ) {
        event.preventDefault();
        start();
      }
      if (event.code === "KeyR" && !event.repeat && !target.closest("dialog")) {
        event.preventDefault();
        start();
      }
      if (event.code === "Escape" && !target.closest("dialog, [role=dialog]")) {
        event.preventDefault();
        if (replay.current) closeReplay();
        else if (session.current.status === "countdown") cancelCountdown();
        else if (session.current.status === "running") pause();
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
      const s = session.current;
      if (s.status === "countdown") {
        const old = Math.ceil(pullIn.current);
        pullIn.current = Math.max(0, pullIn.current - delta);
        const count = Math.ceil(pullIn.current);
        if (count > 0 && count !== old)
          sound.current?.play(`count-${count}` as AudioCue);
        if (!count) {
          s.status = "running";
          if (!history.current.length) history.current = [snapshot(s)];
          previousAudio = audioFrame(s);
        }
      } else {
        const held = (a: string, b: string) =>
          Number(keys.current.has(a) || keys.current.has(b));
        advanceSession(
          s,
          delta,
          {
            x: held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft"),
            y: held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp"),
          },
          (step) => {
            const last = history.current.at(-1);
            const checkpoint = encounter.timeline.some(
              (cast) => step.step === Math.round(Math.max(0, cast.at - 2) * 60),
            );
            if (
              !last ||
              step.step % 6 === 0 ||
              checkpoint ||
              step.events.length !== last.events.length ||
              step.status !== "running"
            )
              history.current.push(snapshot(step));
          },
        );
      }
      sound.current?.setActive(
        !replay.current && (s.status === "running" || s.status === "countdown"),
      );
      const nextAudio = audioFrame(s);
      if (!replay.current && s.elapsed >= previousAudio.elapsed)
        for (const cue of audioCues(previousAudio, nextAudio, encounter, mode))
          sound.current?.play(cue);
      previousAudio = nextAudio;
      if (playing.current && history.current.length) {
        const before = replay.current;
        const next = advanceReplay(
          history.current,
          replayPosition.current,
          delta * speed.current,
        );
        replayPosition.current = next.elapsed;
        replay.current = history.current[next.index];
        if (replaySound.current && before)
          for (const cue of audioCues(
            audioFrame(before),
            audioFrame(replay.current),
            encounter,
            mode,
          ))
            sound.current?.play(cue);
        if (next.ended || now - lastPublished > 90)
          setReviewState(replay.current);
        if (next.ended) {
          playing.current = false;
          setReplayPlaying(false);
        }
      }
      drawArena(
        canvas!,
        encounter,
        replay.current ?? s,
        mode,
        !!replay.current,
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
  }, [
    encounter,
    mode,
    publish,
    start,
    pause,
    cancelCountdown,
    closeReplay,
    toggleReplay,
  ]);
  useEffect(
    () => () => {
      operation.current++;
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

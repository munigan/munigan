"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EncounterDefinition, Snapshot, TrainingMode } from "./model";
import {
  advanceSession,
  createSession,
  getTimers,
  snapshot,
} from "./simulation";
import { drawArena } from "./render-arena";
import { advanceReplay } from "./replay";
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
  initialPreferences: AudioSettings = initialSound,
  onPreferencesChange?: (settings: AudioSettings) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const session = useRef(createSession(encounter));
  const keys = useRef(new Set<string>());
  const history = useRef<Snapshot[]>([]);
  const replay = useRef<Snapshot | null>(null);
  const replayPosition = useRef(0);
  const playingReplay = useRef(false);
  const attempt = useRef(1);
  const pullIn = useRef(0);
  const pausedFrom = useRef<"running" | "countdown">("running");
  const sound = useRef<TrainerAudio | null>(null);
  const audioOperation = useRef(0);
  const settings = useRef(initialPreferences);
  const [audioSettings, setAudioSettings] = useState(initialPreferences);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [reviewState, setReviewState] = useState<Snapshot | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [view, setView] = useState(() => {
    const initial = createSession(encounter);
    return {
      state: snapshot(initial),
      timers: getTimers(initial),
      frameCount: 0,
      attempt: 1,
      pullIn: 0,
    };
  });

  const publish = useCallback(() => {
    setView({
      state: snapshot(session.current),
      timers: getTimers(session.current),
      frameCount: history.current.length,
      attempt: attempt.current,
      pullIn: pullIn.current,
    });
  }, []);
  const enableAudio = useCallback(() => {
    sound.current ??= new TrainerAudio();
    sound.current.configure(settings.current);
    return sound.current.unlock().catch(() => undefined);
  }, []);
  const configureSound = useCallback(
    (update: Partial<AudioSettings>) => {
      audioOperation.current++;
      settings.current = { ...settings.current, ...update };
      setAudioSettings(settings.current);
      onPreferencesChange?.(settings.current);
      sound.current?.configure(settings.current);
      if (settings.current.enabled) void enableAudio();
    },
    [enableAudio, onPreferencesChange],
  );
  const previewSound = useCallback(() => {
    const operation = ++audioOperation.current;
    void enableAudio().then(() => {
      if (operation === audioOperation.current) sound.current?.play("count-3");
    });
  }, [enableAudio]);
  const start = useCallback(() => {
    const operation = ++audioOperation.current;
    if (session.current.status !== "ready") attempt.current++;
    sound.current?.stop();
    session.current = createSession(encounter, attempt.current);
    session.current.status = "countdown";
    pullIn.current = 3;
    keys.current.clear();
    replay.current = null;
    playingReplay.current = false;
    setReviewIndex(null);
    setReviewState(null);
    setReplayPlaying(false);
    history.current = [];
    void enableAudio().then(() => {
      if (
        operation === audioOperation.current &&
        session.current.status === "countdown"
      ) {
        sound.current?.setActive(true);
        sound.current?.play(
          `count-${Math.max(1, Math.ceil(pullIn.current))}` as AudioCue,
        );
      }
    });
    publish();
    canvasRef.current?.focus({ preventScroll: true });
  }, [encounter, enableAudio, publish]);
  const pause = useCallback(() => {
    audioOperation.current++;
    const s = session.current;
    if (s.status === "running" || s.status === "countdown") {
      pausedFrom.current = s.status;
      s.status = "paused";
      sound.current?.stop();
    } else if (s.status === "paused") {
      s.status = pausedFrom.current;
      canvasRef.current?.focus({ preventScroll: true });
    }
    keys.current.clear();
    publish();
  }, [publish]);
  const scrub = useCallback((index: number) => {
    if (!["failed", "complete"].includes(session.current.status)) return;
    const frame = history.current[index];
    if (frame) {
      replay.current = frame;
      replayPosition.current = frame.elapsed;
      setReviewIndex(index);
      setReviewState(frame);
    }
  }, []);
  const seekTime = useCallback(
    (elapsed: number) => {
      const found = history.current.findIndex(
        (frame) => frame.elapsed >= elapsed,
      );
      scrub(found < 0 ? history.current.length - 1 : found);
    },
    [scrub],
  );
  const toggleReplay = useCallback(() => {
    if (!["failed", "complete"].includes(session.current.status)) return;
    if (
      !playingReplay.current &&
      (!replay.current ||
        replayPosition.current >= (history.current.at(-1)?.elapsed ?? 0))
    )
      scrub(0);
    playingReplay.current = !playingReplay.current;
    setReplayPlaying(playingReplay.current);
  }, [scrub]);
  const toggleSound = useCallback(
    () => configureSound({ enabled: !settings.current.enabled }),
    [configureSound],
  );
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
      audioOperation.current++;
      sound.current?.stop();
      clear();
      playingReplay.current = false;
      setReplayPlaying(false);
      if (
        session.current.status === "running" ||
        session.current.status === "countdown"
      ) {
        pausedFrom.current = session.current.status;
        session.current.status = "paused";
        sound.current?.stop();
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
        !canvas.closest(".rt-experiment")?.contains(target)
      )
        return;
      if (
        target.matches("input, select, textarea") ||
        target.isContentEditable ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (movement.includes(event.code)) {
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
      if (event.code === "KeyR" && !event.repeat) {
        event.preventDefault();
        start();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
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
          history.current = [snapshot(s)];
          previousAudio = audioFrame(s);
        }
      } else {
        const held = (a: string, b: string) =>
          Number(keys.current.has(a) || keys.current.has(b));
        advanceSession(s, delta, {
          x: held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft"),
          y: held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp"),
        });
      }
      if (["running", "failed", "complete"].includes(s.status)) {
        const last = history.current.at(-1);
        if (
          !last ||
          s.elapsed - last.elapsed >= 0.099 ||
          (last.status === "running" && s.status !== "running")
        )
          history.current.push(snapshot(s));
      }
      sound.current?.setActive(
        s.status === "running" || s.status === "countdown",
      );
      const nextAudio = audioFrame(s);
      if (s.elapsed >= previousAudio.elapsed)
        for (const cue of audioCues(previousAudio, nextAudio, encounter, mode))
          sound.current?.play(cue);
      previousAudio = nextAudio;
      if (playingReplay.current && history.current.length) {
        const next = advanceReplay(
          history.current,
          replayPosition.current,
          delta,
        );
        replayPosition.current = next.elapsed;
        replay.current = history.current[next.index];
        if (next.ended || now - lastPublished > 90) {
          setReviewIndex(next.index);
          setReviewState(replay.current);
        }
        if (next.ended) {
          playingReplay.current = false;
          setReplayPlaying(false);
        }
      }
      drawArena(
        canvas!,
        encounter,
        replay.current ?? s,
        mode,
        !!replay.current,
      );
      if (now - lastPublished > 90) {
        publish();
        lastPublished = now;
      }
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    const focus = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLElement &&
        !canvas.closest(".rt-experiment")?.contains(event.target)
      )
        loseFocus();
    };
    window.addEventListener("keydown", down);
    canvas.addEventListener("blur", clear);
    document.addEventListener("focusin", focus);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      clear();
      window.removeEventListener("keydown", down);
      canvas.removeEventListener("blur", clear);
      document.removeEventListener("focusin", focus);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", loseFocus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [encounter, mode, pause, publish, start, toggleReplay]);
  useEffect(
    () => () => {
      audioOperation.current++;
      sound.current?.destroy();
      sound.current = null;
    },
    [],
  );

  return {
    canvasRef,
    view,
    start,
    pause,
    scrub,
    seekTime,
    reviewIndex,
    reviewState,
    replayPlaying,
    toggleReplay,
    audioSettings,
    configureSound,
    previewSound,
    soundEnabled: audioSettings.enabled,
    toggleSound,
    touch,
  };
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { SoundSettings } from "./SoundSettings";
import { TrainerSetup } from "./TrainerSetup";
import { trainingCatalog, type TrainingDrill } from "./training-catalog";
import type { EncounterDefinition, TrainingMode } from "./model";
import { useTrainer, initialSound } from "./use-trainer";
import type { AudioSettings } from "./audio-engine";
import { clockTime, practiceCue } from "./practice-state";
import { PullResults, ReplayReview } from "./GameReview";
import { GameIcon, Keycap } from "./GameUi";
import "./trainer.css";

function Drill({
  encounter,
  soundPreferences,
  onSoundPreferences,
  onBack,
}: {
  encounter: EncounterDefinition;
  soundPreferences: AudioSettings;
  onSoundPreferences: (settings: AudioSettings) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<TrainingMode>("guided"),
    [guide, setGuide] = useState(false);
  const { canvasRef, ...t } = useTrainer(
    encounter,
    mode,
    soundPreferences,
    onSoundPreferences,
    true,
  );
  const { state, timers, attempt, pullIn, countdownKind } = t.view;
  const terminal = state.status === "complete" || state.status === "failed",
    replay = !!t.reviewState;
  const cue = practiceCue(state, encounter, mode);
  useEffect(() => {
    if (replay) canvasRef.current?.closest(".rt-game")?.scrollTo({ top: 0 });
  }, [replay, canvasRef]);
  const dialog = useRef<HTMLDialogElement>(null),
    guideButton = useRef<HTMLButtonElement>(null),
    pauseButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector<HTMLElement>(".workbench-shell");
    const oldInert = shell?.inert;
    if (shell) shell.inert = true;
    return () => {
      document.body.style.overflow = oldOverflow;
      if (shell) shell.inert = !!oldInert;
    };
  }, []);
  useEffect(() => {
    if (guide) dialog.current?.showModal();
  }, [guide]);
  useEffect(() => {
    if (state.status === "paused" && !guide) pauseButton.current?.focus();
  }, [state.status, guide]);
  const openGuide = () => {
    if (state.status === "running" || state.status === "countdown") t.pause();
    if (t.replayPlaying) t.toggleReplay();
    setGuide(true);
  };
  useEffect(() => {
    const help = (event: KeyboardEvent) => {
      if (
        event.key === "?" &&
        !event.repeat &&
        event.target instanceof HTMLElement &&
        event.target.closest(".rt-game") &&
        !event.target.matches("input,textarea,select")
      ) {
        event.preventDefault();
        guideButton.current?.click();
      }
    };
    window.addEventListener("keydown", help);
    return () => window.removeEventListener("keydown", help);
  }, []);
  function changeMode(next: TrainingMode) {
    if (state.status === "running" || state.status === "countdown") t.pause();
    setMode(next);
  }
  return (
    <section
      className={`rt-game ${terminal ? "is-result" : ""} ${replay ? "is-replay" : ""} ${state.status === "paused" ? "is-paused" : ""} ${state.status === "ready" ? "is-ready" : ""}`}
      aria-label="The Lich King encounter practice"
    >
      <div className="rt-arena-scene">
        <canvas
          ref={canvasRef}
          width={encounter.arena.width}
          height={encounter.arena.height}
          tabIndex={0}
          aria-label="Encounter arena. You are the class icon labeled YOU, with a blue ring that turns gold when targeted. Move with WASD or arrow keys. Space pauses; R restarts."
        />
      </div>
      {!terminal && state.status !== "ready" && state.status !== "paused" && (
        <div className="rt-top-vignette" aria-hidden="true" />
      )}
      <header className="rt-game-header">
        <div className="rt-boss-identity">
          {encounter.boss.portrait && (
            <span className="rt-boss-ring">
              <Image
                src={encounter.boss.portrait}
                width={52}
                height={52}
                alt=""
                priority
              />
            </span>
          )}
          <div>
            <span className="rt-eyebrow">
              {trainingCatalog.find((raid) => raid.id === encounter.raidId)
                ?.name ?? encounter.location}
            </span>
            <h2>{encounter.name}</h2>
          </div>
        </div>
        <div className="rt-game-top-actions">
          {replay ? (
            <span className="rt-mode-label">
              Replay · Pull {String(attempt).padStart(2, "0")}
            </span>
          ) : (
            <label className="rt-mode-select">
              <span className="rt-sr-only">Practice mode</span>
              <select
                value={mode}
                onChange={(event) =>
                  changeMode(event.target.value as TrainingMode)
                }
              >
                <option value="guided">Guided practice</option>
                <option value="timers">Timers only</option>
              </select>
            </label>
          )}
          <button
            className="rt-button rt-exit"
            onClick={replay ? t.closeReplay : onBack}
          >
            <GameIcon name={replay ? "back" : "exit"} />
            {replay ? "Back to results" : "Exit focus"}
          </button>
        </div>
      </header>
      {!terminal && state.status !== "ready" && (
        <>
          {cue && state.status !== "paused" && (
            <div
              className={`rt-instruction rt-tone-${cue.tone}`}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="rt-eyebrow rt-colored">
                {countdownKind === "resume" && state.status === "countdown"
                  ? "Resuming in a moment"
                  : countdownKind === "practice" && state.status === "countdown"
                    ? "Same cast · same setup"
                    : cue.label}
              </span>
              <h1>{cue.title}</h1>
              <p>{cue.detail}</p>
            </div>
          )}
          <aside className="rt-live-status" aria-label="Live pull status">
            <span className="rt-eyebrow">
              Pull {String(attempt).padStart(2, "0")} ·{" "}
              {state.status === "running" ? "live" : state.status}
            </span>
            <div className="rt-live-clock">
              <strong>{clockTime(state.elapsed)}</strong>
              <span>/ {clockTime(encounter.duration)}</span>
            </div>
            <div className="rt-exposure">
              <div>
                <span>Exposure</span>
                <span>
                  {state.stats.personalHits}
                  <small> / 6</small>
                </span>
              </div>
              <div className="rt-exposure-pips" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <i
                    key={index}
                    className={index < state.stats.personalHits ? "is-hit" : ""}
                  />
                ))}
              </div>
              <p
                className={
                  cue?.id === "danger" && state.stats.personalHits
                    ? "rt-danger-text"
                    : ""
                }
              >
                {cue?.id === "danger" && state.stats.personalHits
                  ? `${state.stats.personalHits} damage ${state.stats.personalHits === 1 ? "tick" : "ticks"}. Recover now.`
                  : state.stats.personalHits
                    ? "No new hits. Keep it clean."
                    : state.stats.raidHits
                      ? "You stayed clear. Keep the return path clear."
                      : "No raid hits. Keep it clean."}
              </p>
              {state.stats.raidHits > 0 && (
                <p className="rt-raid-exposure">
                  Raid exposure <strong>{state.stats.raidHits} ticks</strong>
                </p>
              )}
            </div>
          </aside>
          <aside className="rt-boss-timers" aria-label="Boss timers">
            <div className="rt-eyebrow">
              Boss timers{" "}
              <span>
                {String(
                  Math.min(
                    Math.max(1, state.casts.length),
                    encounter.timeline.length,
                  ),
                ).padStart(2, "0")}{" "}
                / {String(encounter.timeline.length).padStart(2, "0")}
              </span>
            </div>
            {timers
              .filter((timer) => timer.kind !== "regroup")
              .map((timer) => (
                <div
                  key={timer.id}
                  className={`rt-dbm-timer is-${timer.kind} ${timer.kind === "upcoming" && timer.remaining <= (encounter.abilities[encounter.timeline.find((cast) => cast.id === timer.id)?.abilityId ?? ""]?.warningSeconds ?? 0) ? "is-soon" : ""}`}
                  style={
                    {
                      "--timer-color":
                        timer.kind === "cast"
                          ? "#E6BF78"
                          : timer.kind === "regroup"
                            ? "#9CD6F0"
                            : "#B593C6",
                      "--timer-fill": `${Math.min(100, Math.max(0, (timer.remaining / timer.duration) * 100))}%`,
                    } as CSSProperties
                  }
                >
                  {timer.icon && (
                    <Image src={timer.icon} alt="" width={38} height={38} />
                  )}
                  <div className="rt-dbm-bar">
                    <span className="rt-dbm-fill" />
                    <strong>
                      {timer.kind === "cast"
                        ? `${timer.name} on ${state.actors.find((actor) => actor.id === state.casts.find((cast) => !cast.resolved)?.targetId)?.role === "player" ? "you" : (state.actors.find((actor) => actor.id === state.casts.find((cast) => !cast.resolved)?.targetId)?.name ?? "teammate")}`
                        : timer.kind === "upcoming" && state.casts.length > 0
                          ? `Next ${timer.name}`
                          : timer.name}
                    </strong>
                    <time>{timer.remaining.toFixed(1)}</time>
                  </div>
                </div>
              ))}
          </aside>
        </>
      )}
      {state.status === "countdown" && (
        <div
          className="rt-pull-countdown"
          role="status"
          aria-label={`Pull in ${Math.max(1, Math.ceil(pullIn))}`}
        >
          <span>{Math.max(1, Math.ceil(pullIn))}</span>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <section className="rt-ready-panel" aria-label="Ready to practice">
            <div className="rt-ready-heading">
              <span className="rt-eyebrow">Positioning drill</span>
              <h1>Master Defile.</h1>
              <p>
                Watch the timer. Place the pool away from the raid.
                <br />
                Keep moving when it appears.
              </p>
              <div className="rt-ready-facts">
                <span>{encounter.duration} seconds</span>
                <span>{encounter.timeline.length} casts</span>
                <span>{encounter.actors.length} raiders</span>
              </div>
            </div>
            <div className="rt-ready-mode">
              <div
                className="rt-mode-segments"
                role="group"
                aria-label="Coaching mode"
              >
                <button
                  aria-pressed={mode === "guided"}
                  onClick={() => changeMode("guided")}
                >
                  Guided practice
                </button>
                <button
                  aria-pressed={mode === "timers"}
                  onClick={() => changeMode("timers")}
                >
                  Timers only
                </button>
              </div>
              <p>
                {mode === "guided"
                  ? "Short coaching cues while you learn the mechanic."
                  : "Read the timers and sound cues without coaching prompts."}
              </p>
            </div>
            <div className="rt-ready-start">
              <button className="rt-button rt-blue" onClick={t.start}>
                Start pull<Keycap>ENTER</Keycap>
              </button>
              <p>A 3-second countdown gives you time to get ready.</p>
            </div>
          </section>
          <aside className="rt-ready-goal" aria-label="Practice goal">
            <div>
              <span className="rt-eyebrow">The goal</span>
              <h2>Zero damage ticks.</h2>
              <p>
                Every player hit makes the pool bigger. Leave room for your
                teammates to return.
              </p>
            </div>
            <p>
              Sound cues start with the pull.
              <br />
              You can pause at any time.
            </p>
          </aside>
        </>
      )}
      {terminal && !replay && (
        <PullResults
          trainer={t}
          encounter={encounter}
          tryTimers={() => {
            setMode("timers");
            t.start();
          }}
        />
      )}
      {replay && <ReplayReview trainer={t} encounter={encounter} />}
      {!replay && state.status !== "ready" && state.status !== "paused" && (
        <div
          className={`rt-game-dock ${state.status === "countdown" ? "is-countdown" : ""}`}
        >
          {state.status === "countdown" ? (
            <button className="rt-button" onClick={t.cancelCountdown}>
              Cancel {countdownKind === "resume" ? "resume" : "pull"}
              <Keycap>ESC</Keycap>
            </button>
          ) : terminal ? (
            <>
              <button className="rt-button rt-white" onClick={t.start}>
                <GameIcon name="retry" />
                Retry pull<Keycap>R</Keycap>
              </button>
              <button
                className="rt-button"
                onClick={() => {
                  t.openReplay();
                  t.toggleReplay();
                }}
              >
                Replay<Keycap>SPACE</Keycap>
              </button>
            </>
          ) : (
            <>
              <button className="rt-button rt-white" onClick={t.pause}>
                <GameIcon name="pause" />
                Pause
                <Keycap>SPACE</Keycap>
              </button>
              <button className="rt-button" onClick={t.start}>
                Retry<Keycap>R</Keycap>
              </button>
            </>
          )}
          {state.status !== "countdown" && (
            <span className="rt-dock-divider" aria-hidden="true" />
          )}
          {state.status !== "countdown" && (
            <button
              className="rt-button rt-dock-sound"
              onClick={t.toggleSound}
              aria-label={`Sound ${t.audioSettings.enabled ? "on" : "off"}`}
              aria-pressed={t.audioSettings.enabled}
            >
              <GameIcon name={t.audioSettings.enabled ? "volume" : "muted"} />
              <span>Sound {t.audioSettings.enabled ? "on" : "off"}</span>
            </button>
          )}
        </div>
      )}
      <footer className="rt-game-footer">
        {replay ? (
          <button className="rt-text-button" onClick={t.start}>
            <Keycap>R</Keycap> New pull
          </button>
        ) : terminal ? (
          <div className="rt-result-shortcuts">
            <button className="rt-text-button" onClick={t.start}>
              <Keycap>R</Keycap>New pull
            </button>
            <button
              className="rt-text-button"
              onClick={() => {
                t.openReplay();
                t.toggleReplay();
              }}
            >
              <Keycap>SPACE</Keycap>Replay
            </button>
          </div>
        ) : (
          <span className="rt-movement-help">
            <span>
              <Keycap>W</Keycap>
              <Keycap>A</Keycap>
              <Keycap>S</Keycap>
              <Keycap>D</Keycap>
            </span>{" "}
            Move
          </span>
        )}
        {!replay && (
          <button
            ref={guideButton}
            className="rt-text-button rt-guide-trigger"
            onClick={openGuide}
          >
            Mechanic guide<Keycap>?</Keycap>
          </button>
        )}
      </footer>
      {state.status === "running" && !replay && (
        <div className="rt-touch-pad" aria-label="Touch movement">
          {[
            ["KeyW", "↑", "Move up"],
            ["KeyA", "←", "Move left"],
            ["KeyS", "↓", "Move down"],
            ["KeyD", "→", "Move right"],
          ].map(([code, label, name]) => (
            <button
              key={code}
              aria-label={name}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                t.touch(code, true);
              }}
              onPointerUp={() => t.touch(code, false)}
              onPointerCancel={() => t.touch(code, false)}
              onLostPointerCapture={() => t.touch(code, false)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {state.status === "paused" && (
        <div className="rt-pause-backdrop">
          <section
            className="rt-pause-panel"
            role="dialog"
            aria-labelledby="rt-pause-title"
          >
            <div className="rt-pause-heading">
              <span className="rt-eyebrow">
                {t.pauseReason === "focus" ? "Focus lost" : "Practice paused"}
              </span>
              <h1 id="rt-pause-title">
                {t.pauseReason === "focus"
                  ? "Paused when you switched tabs."
                  : "Take a breath."}
              </h1>
              <p>
                Your position, timers and audio are frozen.
                <br />
                Resume with a 3-second countdown.
              </p>
            </div>
            <div className="rt-pause-actions">
              <button
                ref={pauseButton}
                className="rt-button rt-blue"
                onClick={t.pause}
              >
                Resume pull<Keycap>SPACE</Keycap>
              </button>
              <button className="rt-button rt-outline" onClick={t.start}>
                Restart pull<Keycap>R</Keycap>
              </button>
            </div>
          </section>
        </div>
      )}
      {t.audioUnavailable && (
        <div className="rt-audio-notice" role="status">
          <p>
            Sound isn’t available in this browser. Visual warnings are ready.
          </p>
          <button className="rt-button" onClick={t.continueWithoutSound}>
            Continue without sound
          </button>
        </div>
      )}
      {guide && (
        <dialog
          ref={dialog}
          className="rt-guide-dialog"
          onCancel={() => setGuide(false)}
          onClose={() => setGuide(false)}
        >
          <div className="rt-guide-heading">
            <span className="rt-eyebrow">Mechanic guide</span>
            <button
              className="rt-icon-button"
              aria-label="Close mechanic guide"
              onClick={() => setGuide(false)}
            >
              <GameIcon name="close" />
            </button>
          </div>
          <h2>{encounter.name} · Defile</h2>
          <p>{encounter.lesson.summary}</p>
          <ol>
            {encounter.lesson.steps.map(([title, detail]) => (
              <li key={title}>
                <strong>{title}</strong>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
          <p className="rt-guide-limit">
            The practice ends at 6 personal ticks or when the pool takes over
            the platform. A single mistake is your chance to recover.
          </p>
          <SoundSettings
            settings={t.audioSettings}
            configure={t.configureSound}
            preview={t.previewSound}
          />
          <button className="rt-button rt-blue" onClick={() => setGuide(false)}>
            Back to practice
          </button>
        </dialog>
      )}
    </section>
  );
}
export function TrainerExperiment() {
  const [soundPreferences, setSoundPreferences] = useState(initialSound),
    [activeDrill, setActiveDrill] = useState<TrainingDrill | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null),
    returnFocus = useRef(false);
  useEffect(() => {
    if (!activeDrill && returnFocus.current) {
      returnFocus.current = false;
      startButtonRef.current?.focus({ preventScroll: true });
    }
  }, [activeDrill]);
  return (
    <div className="rt-experiment rt-quick-experiment">
      <TrainerSetup
        active={!activeDrill}
        startButtonRef={startButtonRef}
        onStart={setActiveDrill}
      />
      {activeDrill &&
        createPortal(
          <Drill
            key={activeDrill.simulation.id}
            encounter={activeDrill.simulation}
            soundPreferences={soundPreferences}
            onSoundPreferences={setSoundPreferences}
            onBack={() => {
              returnFocus.current = true;
              setActiveDrill(null);
            }}
          />,
          document.body,
        )}
    </div>
  );
}

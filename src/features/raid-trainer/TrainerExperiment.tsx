"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { SoundSettings } from "./SoundSettings";
import { raidCatalog } from "./encounters";
import type { EncounterDefinition, Snapshot, TrainingMode } from "./model";
import { useTrainer, initialSound } from "./use-trainer";
import type { AudioSettings } from "./audio-engine";
import "./trainer.css";

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

function coaching(
  state: Snapshot,
  encounter: EncounterDefinition,
  mode: TrainingMode,
) {
  if (state.status === "ready")
    return {
      title: "Watch the timer. Make your move.",
      text: `${encounter.timeline.length} casts. ${encounter.actors.length} raiders. Keep the platform clear.`,
      tone: "neutral",
    };
  if (state.status === "countdown")
    return {
      title: "Get ready for the pull",
      text: "Find your character. Watch the timer. Breathe.",
      tone: "neutral",
    };
  if (state.status === "paused")
    return {
      title: "Practice paused",
      text: "Your timers and the encounter are frozen.",
      tone: "neutral",
    };
  if (state.status === "failed")
    return {
      title: "Reset. Read it. Try again.",
      text: "Review the moment the pool grew, then take another pull.",
      tone: "danger",
    };
  if (state.status === "complete")
    return {
      title: "Practice complete",
      text: "Scrub through your movement and see what happened.",
      tone: "success",
    };
  const cast = state.casts.find((c) => !c.resolved);
  if (cast) {
    const target = state.actors.find((actor) => actor.id === cast.targetId)!;
    return {
      title: `${encounter.abilities[cast.abilityId].name} on ${target.role === "player" ? "YOU" : target.name}`,
      text:
        mode === "guided"
          ? target.role === "player"
            ? "Move into open space. Keep moving when the pool appears."
            : "Give the target room. Stay out of their path."
          : "Cast in progress",
      tone: "danger",
    };
  }
  const player = state.actors.find((actor) => actor.role === "player")!;
  if (
    state.pools.some(
      (pool) =>
        Math.hypot(player.x - pool.x, player.y - pool.y) <
        pool.radius + player.radius,
    )
  )
    return {
      title: "Move out of the pool!",
      text: "Every damaging tick makes it grow.",
      tone: "danger",
    };
  const next = encounter.timeline.find((event) => event.at > state.elapsed);
  if (
    mode === "guided" &&
    next &&
    next.at - state.elapsed <=
      encounter.abilities[next.abilityId].warningSeconds
  )
    return {
      title: `${encounter.abilities[next.abilityId].name} soon · spread out`,
      text: "Find open space and be ready for the target announcement.",
      tone: "warning",
    };
  return {
    title:
      mode === "guided"
        ? "Stay aware. Watch your timers."
        : "Encounter in progress",
    text:
      mode === "guided"
        ? "Keep an escape route clear. The next target could be you."
        : "Read the timer bars and react to the cast.",
    tone: "neutral",
  };
}

function Drill({
  encounter,
  mode,
  soundPreferences,
  onSoundPreferences,
}: {
  encounter: EncounterDefinition;
  mode: TrainingMode;
  soundPreferences: AudioSettings;
  onSoundPreferences: (settings: AudioSettings) => void;
}) {
  const {
    canvasRef,
    view,
    start,
    pause,
    scrub,
    reviewIndex,
    reviewState,
    seekTime,
    replayPlaying,
    toggleReplay,
    audioSettings,
    configureSound,
    previewSound,
    soundEnabled,
    toggleSound,
    touch,
  } = useTrainer(encounter, mode, soundPreferences, onSoundPreferences);
  const { state, timers, frameCount, attempt, pullIn } = view;
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocused(false);
        if (["running", "countdown"].includes(state.status)) pause();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", escape);
    };
  }, [focused, pause, state.status]);
  const begin = () => {
    setFocused(true);
    start();
  };

  const finished = state.status === "complete" || state.status === "failed";
  const clean = state.stats.personalHits + state.stats.raidHits === 0;
  const displayState = reviewState ?? state;
  const message = coaching(displayState, encounter, mode);
  const activeCast = state.casts.find((cast) => !cast.resolved);
  const next = timers.find((timer) => timer.kind === "upcoming");
  const lesson = activeCast ? 1 : state.pools.length ? 2 : 0;
  const firstMistake = state.events.find((event) => event.kind === "damage");
  const displayCast = displayState.casts.find((cast) => !cast.resolved);
  return (
    <section className={`rt-session ${focused ? "is-focused" : ""}`}>
      <div className="rt-session-heading">
        <div className="rt-boss-identity">
          {encounter.boss.portrait && (
            <Image
              className="rt-boss-portrait"
              src={encounter.boss.portrait}
              alt={encounter.name}
              width={64}
              height={64}
              unoptimized
            />
          )}
          <div>
            <span>ICECROWN CITADEL · POSITIONING</span>
            <h2>{encounter.name}</h2>
            <p>{encounter.subtitle}</p>
          </div>
        </div>
        <div className="rt-session-tools">
          <span className="rt-mode-indicator">
            {mode === "guided" ? "Guided practice" : "Timers only"}
          </span>
          <button
            onClick={() => setFocused(!focused)}
            aria-pressed={focused}
            aria-label={focused ? "Exit focus mode" : "Enter focus mode"}
          >
            {focused ? "↙ Exit focus" : "⛶ Focus mode"}
          </button>
        </div>
      </div>
      <div className="rt-workspace">
        <section className="rt-stage" aria-label="Encounter arena">
          <div className="rt-stage-header">
            <span>
              <span
                className={`rt-dot ${state.status === "running" ? "is-live" : ""}`}
              />
              {finished
                ? "ATTEMPT REVIEW"
                : state.status === "running"
                  ? "ENCOUNTER LIVE"
                  : state.status === "countdown"
                    ? "PREPARING TO PULL"
                    : state.status === "paused"
                      ? "PAUSED"
                      : "READY TO PRACTICE"}
            </span>
            <span>
              ATTEMPT {String(attempt).padStart(2, "0")}
              <i />
              {timestamp(displayState.elapsed)} /{" "}
              {timestamp(encounter.duration)}
            </span>
          </div>
          <div className="rt-arena-wrap">
            <canvas
              ref={canvasRef}
              className="rt-canvas"
              tabIndex={0}
              aria-label="Move your character with W A S D or arrow keys. Space pauses. R retries."
              aria-describedby="rt-controls"
            >
              Interactive arena: use WASD or arrow keys to move away from
              hazards.
            </canvas>
            <div
              className={`rt-callout rt-callout-${message.tone}`}
              role="status"
            >
              <span>
                {activeCast
                  ? "BOSS CAST"
                  : state.status === "ready"
                    ? "YOUR NEXT PULL STARTS HERE"
                    : "RAID AWARENESS"}
              </span>
              <strong>{message.title}</strong>
              <p>{message.text}</p>
            </div>
            {state.status === "countdown" && (
              <div
                className="rt-pull-countdown"
                aria-label={`Pull in ${Math.ceil(pullIn)}`}
              >
                <span>PULL IN</span>
                <strong key={Math.ceil(pullIn)}>{Math.ceil(pullIn)}</strong>
                <p>Get ready.</p>
              </div>
            )}
            {displayCast && (
              <div className="rt-cast-strip">
                <span>◈ {encounter.abilities[displayCast.abilityId].name}</span>
                <strong>
                  {Math.max(
                    0,
                    displayCast.resolvesAt - displayState.elapsed,
                  ).toFixed(1)}
                  s
                </strong>
                <i
                  style={{
                    transform: `scaleX(${Math.max(0, (displayCast.resolvesAt - displayState.elapsed) / encounter.abilities[displayCast.abilityId].castSeconds)})`,
                  }}
                />
              </div>
            )}
            {!finished && (
              <div className="rt-mobile-timer">
                <span>{activeCast ? "CASTING" : "NEXT DEFILE"}</span>
                <strong>
                  {(activeCast
                    ? activeCast.resolvesAt - state.elapsed
                    : (next?.remaining ?? 0)
                  ).toFixed(1)}
                  <small>s</small>
                </strong>
              </div>
            )}
            {state.status === "ready" && (
              <button className="rt-start rt-primary" onClick={begin}>
                <span aria-hidden="true">▶</span> Start practice{" "}
                <kbd>SPACE</kbd>
              </button>
            )}
            {state.status === "paused" && (
              <button className="rt-start rt-primary" onClick={pause}>
                Resume practice <kbd>SPACE</kbd>
              </button>
            )}
            <div className="rt-arena-legend">
              <span>
                <i style={{ background: "#e8fa8a" }} /> You
              </span>
              <span>
                <i style={{ background: "#8ab6da" }} /> Raid
              </span>
              <span>
                <i style={{ background: "#9263ae" }} /> Hazard
              </span>
            </div>
            <span className="rt-arena-caption">
              {encounter.location.toUpperCase()}
            </span>
          </div>
          <div className="rt-live-strip">
            <div>
              <span>EXPOSURE</span>
              <div className="rt-exposure-pips">
                {Array.from({ length: 6 }, (_, i) => (
                  <i
                    key={i}
                    className={
                      i < displayState.stats.personalHits ? "is-hit" : ""
                    }
                  />
                ))}
              </div>
              <b>{displayState.stats.personalHits}/6</b>
            </div>
            <div>
              <span>DEFILE</span>
              <div className="rt-pull-progress">
                {encounter.timeline.map((event, i) => (
                  <span
                    className={displayState.stats.casts > i ? "is-done" : ""}
                    key={event.id}
                  >
                    {displayState.stats.casts > i ? "✓" : i + 1}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span>RAID HITS</span>
              <b className={displayState.stats.raidHits ? "rt-hit-value" : ""}>
                {displayState.stats.raidHits}
              </b>
            </div>
          </div>
          <div className="rt-control-bar" id="rt-controls">
            <div className="rt-key-hint">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
              <span>Move</span>
              <kbd>SPACE</kbd>
              <span>Pause</span>
              <kbd>R</kbd>
              <span>Retry</span>
            </div>
            <div className="rt-control-actions">
              <button
                onClick={toggleSound}
                aria-pressed={soundEnabled}
                aria-label={
                  soundEnabled ? "Mute warning sounds" : "Enable warning sounds"
                }
              >
                {soundEnabled ? "♫ Sound on" : "♪ Sound off"}
              </button>
              <button
                onClick={pause}
                disabled={
                  state.status !== "running" &&
                  state.status !== "paused" &&
                  state.status !== "countdown"
                }
              >
                {state.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button onClick={begin}>↻ Retry</button>
            </div>
          </div>
          <div
            className="rt-touch-controls"
            aria-label="Touch movement controls"
          >
            {[
              ["KeyA", "←", "Move left"],
              ["KeyW", "↑", "Move up"],
              ["KeyS", "↓", "Move down"],
              ["KeyD", "→", "Move right"],
            ].map(([code, symbol, name]) => (
              <button
                key={code}
                aria-label={name}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  touch(code, true);
                }}
                onPointerUp={() => touch(code, false)}
                onPointerCancel={() => touch(code, false)}
                onLostPointerCapture={() => touch(code, false)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </section>
        <aside className="rt-side">
          <section className="rt-timer-panel">
            <div className="rt-section-label">
              <span>BOSS TIMERS</span>
              <span className="rt-tag">DBM STYLE</span>
            </div>
            <h2>
              {finished
                ? "Pull complete"
                : activeCast
                  ? "Cast in progress"
                  : "Next mechanic"}
            </h2>
            {!finished && (
              <div className="rt-next">
                <span>
                  {activeCast
                    ? encounter.abilities[activeCast.abilityId].name
                    : (next?.name ?? "Finish the drill")}
                </span>
                <strong>
                  {(activeCast
                    ? activeCast.resolvesAt - state.elapsed
                    : (next?.remaining ??
                      Math.max(0, encounter.duration - state.elapsed))
                  ).toFixed(1)}
                  <small>s</small>
                </strong>
              </div>
            )}
            <div className="rt-timers" aria-label="Boss ability timers">
              {!finished &&
                timers.map((timer) => (
                  <div
                    className={`rt-timer ${timer.remaining <= 5 ? "rt-timer-urgent" : ""}`}
                    key={`${timer.id}-${timer.kind}`}
                    style={{ "--timer-color": timer.color } as CSSProperties}
                  >
                    <div>
                      <span>
                        {timer.icon && (
                          <Image
                            className="rt-timer-icon"
                            src={timer.icon}
                            alt=""
                            width={24}
                            height={24}
                            unoptimized
                          />
                        )}
                        {timer.kind === "cast"
                          ? "◆"
                          : timer.kind === "regroup"
                            ? "◇"
                            : "◈"}{" "}
                        {timer.name}
                      </span>
                      <b>{timer.remaining.toFixed(1)}</b>
                    </div>
                    <div className="rt-timer-track">
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, (timer.remaining / timer.duration) * 100))}%`,
                        }}
                      />
                    </div>
                    <small>
                      {timer.kind === "cast"
                        ? "CASTING · MOVE NOW"
                        : timer.kind === "regroup"
                          ? "RAID MOVEMENT"
                          : "NEXT CAST"}
                    </small>
                  </div>
                ))}
            </div>
            <p className="rt-timer-note">
              {finished
                ? "Your attempt is ready to review below."
                : mode === "timers"
                  ? "No advance coaching. Anticipate the mechanic from these bars."
                  : "Bars count down to the actual cast. Prepare before they reach zero."}
            </p>
          </section>
          <section className="rt-objective">
            <div className="rt-section-label">THE OBJECTIVE</div>
            <h2>Leave no room for mistakes.</h2>
            <p>{encounter.lesson.summary}</p>
            <ol>
              {encounter.lesson.steps.map(([title, text], i) => (
                <li
                  key={title}
                  className={
                    lesson === i && state.status === "running"
                      ? "rt-lesson-active"
                      : ""
                  }
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <SoundSettings
            settings={audioSettings}
            configure={configureSound}
            preview={previewSound}
          />
          <div className="rt-practice-note">
            <span>◷</span>
            <p>
              <strong>A focused practice preset</strong>
              {encounter.duration} seconds · {encounter.timeline.length} casts ·
              scripted raid
              <br />
              Accelerated, approximate mechanics.
            </p>
          </div>
        </aside>
      </div>
      <div className="rt-metrics" aria-label="Attempt statistics">
        {[
          [
            "CASTS COMPLETED",
            `${state.stats.casts} / ${encounter.timeline.length}`,
            "Recognize every cast",
          ],
          ["YOUR DAMAGE TICKS", state.stats.personalHits, "Aim for zero"],
          ["RAID DAMAGE TICKS", state.stats.raidHits, "Protect the group"],
          ["POOL GROWTH", `+${state.stats.growths}`, "Every hit matters"],
        ].map(([title, value, detail]) => (
          <div key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      {finished && (
        <section className="rt-review" aria-label="Attempt review">
          <div>
            <div className="rt-section-label">POST-PULL REVIEW</div>
            <h2>
              {state.status === "failed"
                ? "The pool got the better of you."
                : clean
                  ? "Clean placement. Clear platform."
                  : "You finished. There’s room to improve."}
            </h2>
            <p>
              {state.stats.personalHits
                ? `You took ${state.stats.personalHits} damaging ticks. Start moving during the cast and keep moving after the pool appears.`
                : state.stats.raidHits
                  ? "You stayed clear, but teammates took damage. Check whether your placement blocked their return path."
                  : "No one took damage. Repeat in Timers only mode to practice anticipating without coaching."}
            </p>
          </div>
          <button className="rt-primary" onClick={begin}>
            ↻ Try another pull
          </button>
          <div className="rt-replay-actions">
            <button onClick={toggleReplay}>
              {replayPlaying ? "Ⅱ Pause replay" : "▶ Play replay"}
            </button>
            {firstMistake && (
              <button
                onClick={() => seekTime(Math.max(0, firstMistake.at - 2))}
              >
                ↶ Jump to first mistake
              </button>
            )}
            <span>
              {timestamp(displayState.elapsed)} / {timestamp(state.elapsed)}
            </span>
          </div>
          <label className="rt-replay-label">
            Review your movement{" "}
            <span>
              {reviewIndex === null
                ? "Drag to inspect the attempt"
                : `Frame ${reviewIndex + 1} of ${frameCount}`}
            </span>
            <input
              aria-label="Replay timeline"
              type="range"
              min="0"
              max={Math.max(0, frameCount - 1)}
              value={reviewIndex ?? Math.max(0, frameCount - 1)}
              onChange={(event) => scrub(Number(event.target.value))}
            />
          </label>
          <div className="rt-event-log">
            {state.events.map((event, i) => (
              <button
                onClick={() => seekTime(Math.max(0, event.at - 1))}
                key={i}
                className={event.kind === "damage" ? "rt-event-damage" : ""}
              >
                <time>{timestamp(event.at)}</time>
                <span>{event.text}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export function TrainerExperiment() {
  const [soundPreferences, setSoundPreferences] = useState(initialSound);
  const [raidId, setRaidId] = useState(raidCatalog[0].id);
  const [encounterId, setEncounterId] = useState(
    raidCatalog[0].encounters[0].id,
  );
  const [mode, setMode] = useState<TrainingMode>("guided");
  const raid = raidCatalog.find((entry) => entry.id === raidId)!;
  const encounter =
    raid.encounters.find((entry) => entry.id === encounterId) ??
    raid.encounters[0];
  return (
    <div className="rt-experiment">
      <header className="rt-heading">
        <div>
          <div className="rt-eyebrow">
            <span>THE PRACTICE GROUNDS</span>
            <span className="rt-experiment-tag">EXPERIMENT 02</span>
          </div>
          <h1>
            Raid Trainer<span>.</span>
          </h1>
          <p>Learn the tell. Make the move. Be ready for raid night.</p>
        </div>
        <div className="rt-heading-detail">
          <span>{raid.expansion.toUpperCase()}</span>
          <strong>Mechanics, one pull at a time.</strong>
        </div>
      </header>
      <div className="rt-selection">
        <div className="rt-select-group">
          <label>
            RAID
            <select
              aria-label="Raid"
              value={raid.id}
              onChange={(event) => {
                setRaidId(event.target.value);
                setEncounterId(
                  raidCatalog.find((r) => r.id === event.target.value)!
                    .encounters[0].id,
                );
              }}
            >
              {raidCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <span className="rt-select-chevron">/</span>
          <label>
            ENCOUNTER
            <select
              aria-label="Encounter"
              value={encounter.id}
              onChange={(event) => setEncounterId(event.target.value)}
            >
              {raid.encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <span className="rt-select-chevron">/</span>
          <div className="rt-ability">
            <span>DRILL</span>
            <strong>
              ◈{" "}
              {Object.values(encounter.abilities)
                .map((a) => a.name)
                .join(" + ")}
            </strong>
          </div>
        </div>
        <div className="rt-mode" role="group" aria-label="Training mode">
          <button
            aria-pressed={mode === "guided"}
            onClick={() => setMode("guided")}
          >
            Guided
          </button>
          <button
            aria-pressed={mode === "timers"}
            onClick={() => setMode("timers")}
          >
            Timers only
          </button>
        </div>
      </div>
      <Drill
        key={`${encounter.id}-${mode}`}
        encounter={encounter}
        mode={mode}
        soundPreferences={soundPreferences}
        onSoundPreferences={setSoundPreferences}
      />
      <footer className="rt-footer">
        <span>
          <i /> Desktop keyboard recommended · Everything runs in your browser
        </span>
        <span>Training preset · Not a frame-exact encounter simulation</span>
      </footer>
    </div>
  );
}

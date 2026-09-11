import { useEffect, useState } from "react";
import type { EncounterDefinition, TrainerEvent } from "./model";
import type { TrainerController } from "./use-trainer";
import {
  castReview,
  clockTime,
  eventTitle,
  firstMistake,
  outcome,
} from "./practice-state";
import { GameIcon, Keycap } from "./GameUi";

function sameEvent(a: TrainerEvent | undefined, b: TrainerEvent | undefined) {
  return (
    !!a && !!b && a.at === b.at && a.kind === b.kind && a.castId === b.castId
  );
}

export function PullResults({
  trainer: t,
  encounter,
  tryTimers,
}: {
  trainer: TrainerController;
  encounter: EncounterDefinition;
  tryTimers: () => void;
}) {
  const { state, attempt } = t.view;
  const result = outcome(state),
    mistake = firstMistake(state),
    casts = castReview(encounter, state);
  const hits = state.stats.personalHits + state.stats.raidHits;
  const firstDrop = state.events.find(
    (event) => event.kind === "pool" && event.castId === mistake?.castId,
  );
  const cleanAfter = mistake
    ? casts.filter(
        (cast) =>
          cast.at > mistake.at && cast.reached && !cast.personal && !cast.raid,
      ).length
    : 0;
  const title =
    result === "clean"
      ? "Clean pull."
      : result === "imperfect"
        ? "Finished.\nNow refine it."
        : result === "overrun"
          ? "The pool\ntook over."
          : "Defile\ncaught you.";
  return (
    <>
      <section
        className={`rt-result-summary rt-tone-${result === "clean" ? "success" : result === "imperfect" ? "warning" : "danger"}`}
        aria-label="Pull results"
      >
        <div className="rt-result-heading">
          <span className="rt-eyebrow rt-colored">
            Pull {String(attempt).padStart(2, "0")}{" "}
            {state.status === "failed" ? "ended" : "complete"} ·{" "}
            {clockTime(state.elapsed)}
          </span>
          <h1>{title}</h1>
          <p>
            {result === "clean"
              ? `${casts.length === 3 ? "Three" : casts.length} casts. No damage ticks. Your positioning kept the raid clear.`
              : result === "exposure"
                ? `You reached ${state.stats.personalHits} damage ticks. The pull ended so you can review what happened.`
                : result === "overrun"
                  ? "The pool covered too much of the platform. Check the raid’s return path in the replay."
                  : `You survived all ${casts.length} casts with ${hits} damage ${hits === 1 ? "tick" : "ticks"}.${cleanAfter ? ` You recovered and kept the next ${cleanAfter === 2 ? "two" : cleanAfter} clean.` : " Review the hits to refine your next pull."}`}
          </p>
        </div>
        <div className="rt-result-stats">
          <div>
            <span>Your ticks</span>
            <strong
              className={
                result === "clean"
                  ? "rt-clean-text"
                  : result === "imperfect"
                    ? "rt-gold-text"
                    : state.stats.personalHits
                      ? "rt-danger-text"
                      : ""
              }
            >
              {state.stats.personalHits}
            </strong>
          </div>
          <div>
            <span>Raid ticks</span>
            <strong className={state.stats.raidHits ? "rt-danger-text" : ""}>
              {state.stats.raidHits}
            </strong>
          </div>
          <div>
            <span>Growth</span>
            <strong>+{state.stats.growths}</strong>
          </div>
        </div>
        <div className="rt-result-lesson">
          <span className="rt-eyebrow">
            {result === "clean"
              ? "Build the habit"
              : result === "imperfect"
                ? "One moment to work on"
                : result === "overrun"
                  ? "Keep the return path clear"
                  : "Keep moving after the drop"}
          </span>
          <p>
            {!mistake
              ? "Repeat the drill with only timers and sound cues. Let your positioning do the work."
              : result === "overrun" || !mistake.personalHits
                ? `A teammate took a tick at ${clockTime(mistake.at)}. Leave a clear path around the pool for the raid to return.`
                : result === "imperfect"
                  ? `You were still in ${mistake.castId === encounter.timeline[0]?.id ? "the first pool" : "the pool"} at ${clockTime(mistake.at)}. Keep moving as soon as it appears.`
                  : `Your first hit was at ${clockTime(mistake.at)}${firstDrop ? `, ${Math.round(mistake.at - firstDrop.at) === 1 ? "one second" : `${Math.round(mistake.at - firstDrop.at)} seconds`} after the pool appeared` : ""}.`}
          </p>
        </div>
      </section>
      <aside className="rt-cast-review" aria-label="Cast review">
        <span className="rt-eyebrow">Cast review</span>
        {casts.map((cast) => (
          <button
            className="rt-cast-row"
            key={cast.id}
            disabled={!cast.reached}
            onClick={() =>
              t.openReplay(
                Math.max(0, (cast.firstHit?.at ?? cast.at) - 2),
                cast.firstHit ??
                  state.events.find(
                    (event) =>
                      event.castId === cast.id && event.kind === "pool",
                  ) ??
                  state.events.find((event) => event.castId === cast.id),
              )
            }
          >
            <span
              className={`rt-cast-number ${cast.personal + cast.raid ? "is-hit" : cast.reached ? "is-clean" : ""}`}
            >
              {cast.index + 1}
            </span>
            <span>
              <strong>
                {cast.name} {cast.index + 1}
              </strong>
              <small>
                {clockTime(cast.at)} · on{" "}
                {cast.target.toLowerCase() === "you" ? "you" : cast.target}
              </small>
            </span>
            <span
              className={
                cast.personal + cast.raid
                  ? "rt-danger-text"
                  : cast.reached
                    ? "rt-clean-text"
                    : "rt-muted"
              }
            >
              {!cast.reached
                ? "Not reached"
                : cast.personal + cast.raid
                  ? `${cast.personal + cast.raid} ${cast.personal + cast.raid === 1 ? "tick" : "ticks"}`
                  : cast.cast?.resolved
                    ? "Clean"
                    : "Casting"}
            </span>
          </button>
        ))}
        <div className="rt-review-action">
          <button
            className="rt-button rt-blue"
            onClick={
              result === "clean"
                ? tryTimers
                : () => t.openReplay(Math.max(0, (mistake?.at ?? 2) - 2))
            }
          >
            {result === "clean"
              ? "Try Timers only"
              : result === "overrun"
                ? "Review pool growth"
                : "Review first mistake"}
          </button>
          <p className="rt-hint">
            {result === "clean"
              ? "Same drill · without coaching prompts"
              : `Jump to ${clockTime(Math.max(0, (mistake?.at ?? 2) - 2))} · two seconds before the hit`}
          </p>
        </div>
      </aside>
    </>
  );
}

export function ReplayReview({
  trainer: t,
  encounter,
}: {
  trainer: TrainerController;
  encounter: EncounterDefinition;
}) {
  const state = t.reviewState!;
  const final = t.view.state,
    events = final.events,
    mistake = firstMistake(final);
  const [selected, setSelected] = useState<TrainerEvent | undefined>(
    () =>
      t.reviewEvent ??
      mistake ??
      events.find((event) => event.kind === "pool") ??
      events[0],
  );
  const [trail, setTrail] = useState(true),
    [growth, setGrowth] = useState(true);
  const ended = state.elapsed >= final.elapsed - 0.01;
  const selectedCast = encounter.timeline.find(
    (cast) => cast.id === selected?.castId,
  );
  const castNumber = selectedCast
    ? encounter.timeline.indexOf(selectedCast) + 1
    : 1;
  const isFirstTick = sameEvent(selected, mistake);
  const drop = events.find(
    (event) => event.kind === "pool" && event.castId === selected?.castId,
  );
  const exposureBefore = events
    .filter((event) => event.at < (selected?.at ?? 0))
    .reduce((sum, event) => sum + (event.personalHits ?? 0), 0);
  const { setArenaOptions } = t;
  useEffect(() => {
    setArenaOptions({
      showTrail: trail,
      showGrowth: growth,
      recordedTrail: final.trail.filter(
        (point) =>
          point.at >= (selectedCast?.at ?? 0) &&
          point.at <= Math.min(drop?.at ?? state.elapsed, state.elapsed),
      ),
      highlightedEvent:
        selected?.position && state.elapsed >= selected.at
          ? {
              ...selected.position,
              at: selected.at,
              text: eventTitle(selected),
              label:
                selected.kind === "damage"
                  ? isFirstTick
                    ? "FIRST TICK"
                    : "DAMAGE TICK"
                  : selected.kind === "pool"
                    ? "PLACEMENT"
                    : "CAST BEGINS",
              detail:
                selected.kind === "damage"
                  ? selected.personalHits
                    ? "You were still inside."
                    : "A teammate was inside."
                  : eventTitle(selected),
            }
          : null,
    });
  }, [
    setArenaOptions,
    trail,
    growth,
    selected,
    isFirstTick,
    state.elapsed,
    final.trail,
    selectedCast?.at,
    drop?.at,
  ]);
  const choose = (event: TrainerEvent) => {
    setSelected(event);
    t.seekEvent(event);
  };
  return (
    <>
      <section className="rt-replay-summary" aria-label="Replay overview">
        <div className="rt-replay-heading">
          <span className="rt-eyebrow">
            Replay · {ended ? "ended" : t.replayPlaying ? "playing" : "paused"}
          </span>
          <h1>
            {!mistake
              ? "No damage\nevents."
              : isFirstTick
                ? "The first\ndamaging tick."
                : selected?.kind === "damage"
                  ? "Review this\ndamaging tick."
                  : selected?.kind === "pool"
                    ? "Review the\nplacement."
                    : "Review the\ncast."}
          </h1>
          <p>
            {mistake
              ? "Follow your path from the cast to the drop. This is the moment the pool started growing."
              : `All ${final.stats.casts} casts were clean. Watch your placements and the space you left for the raid.`}
          </p>
        </div>
        <div className="rt-replay-clock">
          <strong>{clockTime(state.elapsed, true)}</strong>
          <span>/ {clockTime(final.elapsed)}</span>
        </div>
        <label className="rt-replay-toggle">
          <input
            type="checkbox"
            checked={trail}
            onChange={(event) => setTrail(event.target.checked)}
          />
          <span>
            <strong>Your path</strong>
            <small>From the cast to the drop</small>
          </span>
        </label>
        <label className="rt-replay-toggle">
          <input
            type="checkbox"
            checked={growth}
            onChange={(event) => setGrowth(event.target.checked)}
          />
          <span>
            <strong>Pool growth</strong>
            <small>Dashed ring = original size</small>
          </span>
        </label>
      </section>
      <aside className="rt-event-inspector" aria-label="Event inspector">
        {selected ? (
          <>
            <div className="rt-event-heading">
              <span
                className={`rt-eyebrow ${selected.kind === "damage" ? "rt-danger-text" : ""}`}
              >
                {clockTime(selected.at, true)} ·{" "}
                {selected.kind === "damage"
                  ? isFirstTick
                    ? "First damage tick"
                    : "Damage tick"
                  : selected.kind === "pool"
                    ? "Placement"
                    : selected.kind === "cast"
                      ? "Cast begins"
                      : "Regroup"}
              </span>
              <h2>{eventTitle(selected)}</h2>
              <p>
                {selected.kind === "damage" && selected.personalHits
                  ? `Defile dropped${drop ? ` at ${clockTime(drop.at)}` : ""}. You were inside when it dealt ${isFirstTick ? "its first" : "this"} tick of damage.`
                  : selected.text}
              </p>
            </div>
            {selected.kind === "damage" && (
              <div className="rt-event-stats">
                <div>
                  <span>Your exposure</span>
                  <strong>
                    {exposureBefore} →{" "}
                    {exposureBefore + (selected.personalHits ?? 0)}
                  </strong>
                </div>
                {!!selected.raidHits && (
                  <div>
                    <span>Raid exposure</span>
                    <strong>+{selected.raidHits}</strong>
                  </div>
                )}
                <div>
                  <span>Pool growth</span>
                  <strong>+{selected.growth ?? 0}</strong>
                </div>
              </div>
            )}
            <div className="rt-next-try">
              <span className="rt-eyebrow">On your next try</span>
              <p>
                {selected.kind === "damage"
                  ? "Keep moving after the pool appears. A good drop still needs a clean exit."
                  : selected.kind === "pool"
                    ? "Drop the pool in open space, with a clear way back for your teammates."
                    : "Read the timer early and give the target room to move."}
              </p>
            </div>
            {selectedCast && (
              <div className="rt-practice-action">
                <button
                  className="rt-button rt-blue"
                  onClick={() => t.practiceCast(selectedCast.id)}
                >
                  Practice cast {castNumber}
                </button>
                <p className="rt-hint">
                  Starts at {clockTime(Math.max(0, selectedCast.at - 2))} · same
                  setup
                </p>
              </div>
            )}
          </>
        ) : (
          <p>No events recorded in this pull.</p>
        )}
      </aside>
      <ReplayTransport trainer={t} selected={selected} choose={choose} />
    </>
  );
}

function ReplayTransport({
  trainer: t,
  selected,
  choose,
}: {
  trainer: TrainerController;
  selected?: TrainerEvent;
  choose: (event: TrainerEvent) => void;
}) {
  const final = t.view.state,
    elapsed = t.reviewState!.elapsed;
  const duration = Math.max(1, final.elapsed),
    ended = elapsed >= duration - 0.01;
  const x = (at: number) => 2 + 676 * Math.min(1, Math.max(0, at / duration));
  const interval =
    [5, 10, 15, 30, 60, 120, 300].find((step) => duration / step <= 4) ??
    Math.ceil(duration / 4);
  const ticks = [0];
  // Reserve room for the right-aligned end label, including on narrow screens.
  for (
    let at = interval;
    at < duration - Math.max(interval / 3, duration * 0.18);
    at += interval
  )
    ticks.push(at);
  ticks.push(duration);
  const events = final.events.filter((event) => event.kind !== "regroup");
  return (
    <section className="rt-replay-transport" aria-label="Replay controls">
      <div className="rt-timeline">
        <svg viewBox="0 0 680 40" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M2 10H678"
            stroke="#3A444C"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d={`M2 10H${x(elapsed)}`}
            stroke="#9CD6F0"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {events.map((event, index) =>
            event.kind === "damage" ? (
              <path
                key={index}
                d={`M${x(event.at)} ${sameEvent(event, selected) || index === events.length - 1 ? 1 : 5}V${sameEvent(event, selected) || index === events.length - 1 ? 20 : 15}`}
                stroke="#F58D88"
                strokeWidth="2"
              />
            ) : (
              <path
                key={index}
                d={`M${x(event.at)} 3l7 7-7 7-7-7Z`}
                fill={event.kind === "cast" ? "#E6BF78" : "#B393CF"}
              />
            ),
          )}
          <circle
            cx={x(elapsed)}
            cy="10"
            r="6"
            fill="#F3F4F6"
            stroke="#17191D"
            strokeWidth="2"
          />
        </svg>
        <div className="rt-time-axis" aria-hidden="true">
          {ticks.map((at, index) => (
            <span
              key={at}
              style={{
                left: `${(at / duration) * 100}%`,
                transform: `translateX(${index === 0 ? 0 : index === ticks.length - 1 ? -100 : -50}%)`,
              }}
            >
              {clockTime(at)}
            </span>
          ))}
        </div>
        <input
          aria-label="Replay timeline"
          aria-valuetext={`${clockTime(elapsed, true)} of ${clockTime(duration)}`}
          type="range"
          min="0"
          max={final.elapsed}
          step="0.1"
          value={elapsed}
          onChange={(event) => t.seekTime(Number(event.target.value))}
        />
        <div className="rt-timeline-events">
          {events.map((event, index) => (
            <button
              key={index}
              style={{ left: `${(x(event.at) / 680) * 100}%` }}
              className={`rt-event-marker is-${event.kind}`}
              aria-label={`${clockTime(event.at, true)} ${event.text}`}
              aria-pressed={sameEvent(event, selected)}
              title={`${clockTime(event.at, true)} · ${event.text}`}
              onClick={() => choose(event)}
            />
          ))}
        </div>
      </div>
      <div className="rt-replay-buttons">
        <div className="rt-replay-playback">
          <button
            className="rt-button rt-step"
            aria-label="Back one second"
            onClick={() => t.seekTime(elapsed - 1)}
          >
            −1s
          </button>
          <button className="rt-button rt-white" onClick={t.toggleReplay}>
            <GameIcon name={t.replayPlaying ? "pause" : "play"} />
            {t.replayPlaying ? "Pause" : ended ? "Replay again" : "Play"}
            <Keycap>SPACE</Keycap>
          </button>
          <button
            className="rt-button rt-step"
            aria-label="Forward one second"
            onClick={() => t.seekTime(elapsed + 1)}
          >
            +1s
          </button>
        </div>
        <div className="rt-speed" aria-label="Playback speed">
          {[0.5, 1, 2].map((speed) => (
            <button
              key={speed}
              aria-pressed={t.replaySpeed === speed}
              onClick={() => t.setSpeed(speed)}
            >
              {speed}×
            </button>
          ))}
        </div>
        <button
          className="rt-text-button rt-replay-sound"
          onClick={t.toggleReplaySound}
          aria-label={`Replay sound ${t.replayAudible ? "on" : "off"}`}
          aria-pressed={t.replayAudible}
        >
          Sound {t.replayAudible ? "on" : "off"}
        </button>
      </div>
    </section>
  );
}

import { recordedEventPath } from "./replay";
import { useEffect, useMemo, useState } from "react";
import type { RunSpec, WorldEvent } from "./scenario-model";
import type { TrainerController } from "./use-trainer";
import {
  castReview,
  clockTime,
  eventTitle,
  firstMistake,
  outcome,
  exposureCounts,
  endReasonText,
} from "./practice-state";
import { supportingMechanics } from "./training-catalog";
import { GameIcon, Keycap } from "./GameUi";

function sameEvent(a: WorldEvent | undefined, b: WorldEvent | undefined) {
  return !!a && !!b && a.id === b.id;
}
function reviewEvents(events: WorldEvent[]) {
  return events.filter((event) =>
    [
      "cast",
      "target",
      "pool",
      "damage",
      "pickup",
      "release",
      "return",
      "explosion",
      "formation",
      "relocate",
      "end",
    ].includes(event.kind),
  );
}
export function PullResults({
  trainer: t,
  run,
  tryTimers,
}: {
  trainer: TrainerController;
  run: RunSpec;
  tryTimers: () => void;
}) {
  const { world: state, attempt } = t.view;
  const result = outcome(t.view),
    mistake = firstMistake(t.view),
    casts = castReview(run, t.view);
  const primary = exposureCounts(t.view, run.focus),
    supporting = exposureCounts(
      t.view,
      run.focus === "defile" ? "vile-spirits" : "defile",
    );
  const primaryMisses = t.view.findings.filter(
    (finding) => finding.mechanic === run.focus && finding.severity === "miss",
  );
  const supportingMisses = t.view.findings.filter(
    (finding) => finding.mechanic !== run.focus && finding.severity === "miss",
  );
  const recovered =
    t.view.findings.some(
      (finding) =>
        finding.actorId === "you" &&
        finding.code === "exposure" &&
        finding.severity === "miss",
    ) &&
    state.status === "complete" &&
    !state.pools.some((pool) => {
      const you = state.actors.find((actor) => actor.id === "you")!;
      return (
        Math.hypot(you.x - pool.x, you.y - pool.y) < pool.radius + you.radius
      );
    }) &&
    !t.view.findings.some(
      (finding) =>
        finding.actorId === "you" &&
        finding.severity === "miss" &&
        finding.at > state.elapsed - 3,
    );
  const title =
    result === "clean"
      ? "Clean pull."
      : result === "imperfect"
        ? "Finished.\nNow refine it."
        : state.endReason === "platform-unusable"
          ? "The pool\ntook over."
          : state.endReason === "recording-limit"
            ? "Recording\ninterrupted."
            : "Exercise\nended.";
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
            {endReasonText(t.view)}{" "}
            {recovered ? "You recovered into clear ground before the end." : ""}
          </p>
        </div>
        <div className="rt-result-stats">
          <div>
            <span>
              Your {run.focus === "defile" ? "Defile ticks" : "spirit bursts"}
            </span>
            <strong
              className={primary.personal ? "rt-gold-text" : "rt-clean-text"}
            >
              {primary.personal}
            </strong>
          </div>
          <div>
            <span>
              Raid {run.focus === "defile" ? "Defile ticks" : "spirit bursts"}
            </span>
            <strong className={primary.raid ? "rt-danger-text" : ""}>
              {primary.raid}
            </strong>
          </div>
          <div>
            <span>Growth</span>
            <strong>
              +
              {state.events
                .filter(
                  (event) =>
                    event.kind === "damage" && event.mechanic === "defile",
                )
                .reduce((sum, event) => sum + event.amount, 0)}
            </strong>
          </div>
        </div>
        <div className="rt-result-lesson" aria-label="Focus findings">
          <span className="rt-eyebrow">
            Focus · {run.focus === "defile" ? "Defile" : "Vile Spirits"}
          </span>
          <p>
            {!primary.personal
              ? "No personal " +
                (run.focus === "defile"
                  ? "Defile ticks."
                  : "spirit burst hits.")
              : "Keep a clear exit after the drop."}
            {primary.raid ? " Teammates also took exposure ticks." : ""}
          </p>
          {!!primaryMisses.length && (
            <p>
              {primaryMisses[0].detail} at {clockTime(primaryMisses[0].at)}.
            </p>
          )}
        </div>
        <div
          className="rt-result-lesson rt-supporting-findings"
          aria-label="Supporting findings"
        >
          <span className="rt-eyebrow">
            Supporting · {supportingMechanics(run)}
          </span>
          {supportingMechanics(run) === "Val’kyrs" ? (
            <p>
              {state.events.filter((event) => event.kind === "pickup").length}{" "}
              NPC pickups ·{" "}
              {state.events.filter((event) => event.kind === "release").length}{" "}
              rescues.
            </p>
          ) : (
            <p>
              {supporting.personal} personal · {supporting.raid} raid{" "}
              {run.focus === "defile" ? "spirit burst hits" : "Defile ticks"}.
            </p>
          )}
          <p>
            {supportingMisses.length
              ? `${supportingMisses[0].actorId === "you" ? "You" : "A teammate"}: ${supportingMisses[0].detail} at ${clockTime(supportingMisses[0].at)}.`
              : "No supporting positioning misses recorded."}
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
                Math.max(0, (cast.reviewEvent?.at ?? cast.at) - 2),
                cast.reviewEvent ?? cast.event,
              )
            }
          >
            <span
              className={`rt-cast-number ${cast.imperfect ? "is-hit" : cast.reached ? "is-clean" : ""}`}
            >
              {cast.index + 1}
            </span>
            <span>
              <strong>
                {cast.name} {cast.index + 1}
              </strong>
              <small>
                {clockTime(cast.at)} · {cast.target}
              </small>
              {cast.positioningMiss && (
                <small>{cast.positioningMiss.detail}</small>
              )}
            </span>
            <span
              className={
                cast.imperfect
                  ? "rt-danger-text"
                  : cast.reached
                    ? "rt-clean-text"
                    : "rt-muted"
              }
            >
              {!cast.reached
                ? "Not reached"
                : cast.imperfect
                  ? `${cast.personal + cast.raid} ticks`
                  : cast.cast?.resolved
                    ? "Clean"
                    : "Casting"}
            </span>
          </button>
        ))}
        <div className="rt-review-action">
          <button className="rt-button rt-blue" onClick={t.start}>
            Retry same situation<Keycap>R</Keycap>
          </button>
          <button
            className="rt-button"
            disabled={t.preparing}
            onClick={() => void t.newVariation()}
          >
            New variation
          </button>
          {mistake && (
            <button
              className="rt-button"
              onClick={() => t.openReplay(Math.max(0, mistake.at - 2), mistake)}
            >
              Review first mistake
            </button>
          )}
          {result === "clean" && run.mode === "guided" && (
            <button className="rt-button" onClick={tryTimers}>
              Try Timers only
            </button>
          )}
          <p className="rt-hint">Retry keeps the same scenario and seed.</p>
        </div>
      </aside>
    </>
  );
}

export function ReplayReview({
  trainer: t,
  run,
}: {
  trainer: TrainerController;
  run: RunSpec;
}) {
  const state = t.reviewState!.world,
    final = t.view.world,
    events = final.events,
    mistake = firstMistake(t.view);
  const [selected, setSelected] = useState<WorldEvent | undefined>(
    () =>
      t.reviewEvent ??
      mistake ??
      events.find((event) => event.kind === "pool") ??
      reviewEvents(events)[0],
  );
  const [trail, setTrail] = useState(true),
    [growth, setGrowth] = useState(true);
  const ended = state.elapsed >= final.elapsed - 0.01;
  const isFirst = sameEvent(selected, mistake);
  const finding = t.view.findings.find(
    (finding) =>
      finding.eventId === selected?.id && finding.severity === "miss",
  );
  const checkpoint = run.scenario.checkpoints.find(
    (checkpoint) => checkpoint.id === selected?.checkpointId,
  );
  const exposureBefore = events.filter(
    (event) =>
      event.at < (selected?.at ?? 0) &&
      event.actorIds.includes("you") &&
      !event.protectedActorIds.includes("you") &&
      ["damage", "explosion"].includes(event.kind),
  ).length;
  const { setArenaOptions, recording } = t;
  const path = useMemo(
    () => recordedEventPath(recording, selected, state.elapsed),
    [recording, selected, state.elapsed],
  );
  useEffect(() => {
    setArenaOptions({
      showTrail: trail,
      showGrowth: growth,
      recordedTrail: path.points,
      highlightedEvent:
        selected?.position && state.elapsed >= selected.at ? selected : null,
      highlightedLabel: selected ? eventTitle(selected) : undefined,
      highlightedDetail: finding?.detail,
    });
  }, [
    setArenaOptions,
    recording,
    trail,
    growth,
    selected,
    state.elapsed,
    path,
    finding?.detail,
  ]);
  const choose = (event: WorldEvent) => {
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
              ? "No positioning\nmisses."
              : isFirst
                ? "The first\nmissed moment."
                : selected
                  ? eventTitle(selected)
                  : "Review\nthe pull."}
          </h1>
          <p>
            {mistake
              ? "Review the recorded positioning and supporting mechanics at this moment."
              : "Watch your placement and the space available to the raid."}
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
            <strong>{path.label}</strong>
            <small>{path.description}</small>
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
        <label className="rt-recorded-event">
          <span className="rt-eyebrow">Recorded event</span>
          <select
            aria-label="Recorded event"
            value={selected?.id ?? ""}
            onChange={(event) => {
              const next = events.find(
                (candidate) => candidate.id === event.target.value,
              );
              if (next) choose(next);
            }}
          >
            {reviewEvents(events).map((event) => (
              <option key={event.id} value={event.id}>
                {clockTime(event.at, true)} · {eventTitle(event)}
                {event.actorIds.length
                  ? ` · ${event.actorIds
                      .slice(0, 2)
                      .map(
                        (id) =>
                          final.actors.find((actor) => actor.id === id)?.name ??
                          id,
                      )
                      .join(
                        ", ",
                      )}${event.actorIds.length > 2 ? ` +${event.actorIds.length - 2}` : ""}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <>
            <div className="rt-event-heading">
              <span className="rt-eyebrow">
                {clockTime(selected.at, true)} ·{" "}
                {isFirst ? "First missed moment" : eventTitle(selected)}
              </span>
              <h2>{eventTitle(selected)}</h2>
              <p>
                {finding
                  ? `${finding.actorId === "you" ? "You" : "A teammate"}: ${finding.detail}.`
                  : "Recorded " + eventTitle(selected).toLowerCase() + "."}
              </p>
            </div>
            {["damage", "explosion"].includes(selected.kind) && (
              <div className="rt-event-stats">
                <div>
                  <span>Your exposure</span>
                  <strong>
                    {exposureBefore} →{" "}
                    {exposureBefore +
                      Number(
                        selected.actorIds.includes("you") &&
                          !selected.protectedActorIds.includes("you"),
                      )}
                  </strong>
                </div>
                <div>
                  <span>Raid exposure</span>
                  <strong>
                    +
                    {
                      selected.actorIds.filter(
                        (id) =>
                          id !== "you" &&
                          !selected.protectedActorIds.includes(id),
                      ).length
                    }
                  </strong>
                </div>
              </div>
            )}
            <div className="rt-next-try">
              <span className="rt-eyebrow">On your next try</span>
              <p>
                {selected.mechanic === "defile"
                  ? "Keep a clear exit after the pool appears and leave the raid route open."
                  : selected.mechanic === "vile-spirits"
                    ? "Keep clear of spirit bursts while following the raid relocation."
                    : "Use the supporting timers and return to the assigned formation."}
              </p>
            </div>
            {checkpoint && (
              <div className="rt-practice-action">
                <button
                  className="rt-button rt-blue"
                  onClick={() => t.practiceCast(checkpoint.id)}
                >
                  Practice this moment
                </button>
                <p className="rt-hint">
                  Starts at {clockTime(checkpoint.at)} · same setup
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
  selected?: WorldEvent;
  choose: (event: WorldEvent) => void;
}) {
  const final = t.view.world,
    elapsed = t.reviewState!.world.elapsed;
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
  const events = reviewEvents(final.events);
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
            event.kind === "damage" || event.kind === "explosion" ? (
              <path
                key={event.id}
                d={`M${x(event.at)} ${sameEvent(event, selected) || index === events.length - 1 ? 1 : 5}V${sameEvent(event, selected) || index === events.length - 1 ? 20 : 15}`}
                stroke="#F58D88"
                strokeWidth="2"
              />
            ) : (
              <path
                key={event.id}
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
          {events.map((event) => (
            <button
              key={event.id}
              style={{ left: `${(x(event.at) / 680) * 100}%` }}
              className={`rt-event-marker is-${event.kind}`}
              aria-label={`${clockTime(event.at, true)} ${eventTitle(event)}`}
              aria-pressed={sameEvent(event, selected)}
              title={`${clockTime(event.at, true)} · ${eventTitle(event)}`}
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

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Select, SelectOption } from "@/components/ui/Select";
import { trainingCatalog, type TrainingDrill } from "./training-catalog";
import { PlacementPreview } from "./PlacementPreview";
import { prepareArenaAssets } from "./arena-assets";
import "./trainer-setup.css";

function SelectionImage({
  src,
  round = false,
}: {
  src: string;
  round?: boolean;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      className={`rt-selection-image${round ? " is-round" : ""}`}
    />
  );
}

export function TrainerSetup({
  active,
  startButtonRef,
  onStart,
}: {
  active: boolean;
  startButtonRef: RefObject<HTMLButtonElement | null>;
  onStart: (drill: TrainingDrill) => void;
}) {
  const [raidId, setRaidId] = useState(trainingCatalog[0].id);
  const [encounterId, setEncounterId] = useState(
    trainingCatalog[0].encounters[0].id,
  );
  const [drillId, setDrillId] = useState(
    trainingCatalog[0].encounters[0].drills[0].id,
  );
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const starting = useRef(false);
  const request = useRef(0),
    loadingDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (preparing) loadingDialog.current?.showModal();
  }, [preparing]);
  function cancelPreparation() {
    request.current++;
    starting.current = false;
    setPreparing(false);
  }
  const raid =
    trainingCatalog.find((entry) => entry.id === raidId) ?? trainingCatalog[0];
  const encounter =
    raid.encounters.find((entry) => entry.id === encounterId) ??
    raid.encounters[0];
  const drill =
    encounter.drills.find((entry) => entry.id === drillId) ??
    encounter.drills[0];

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      // Never steal Enter from a menu, field, link or other button.
      if (
        event.target !== document.body &&
        event.target !== document.documentElement
      )
        return;
      event.preventDefault();
      startButtonRef.current?.click();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, startButtonRef]);

  async function begin() {
    if (starting.current) return;
    starting.current = true;
    const id = ++request.current;
    setPreparing(true);
    setError("");
    try {
      await prepareArenaAssets(drill.simulation);
      if (id === request.current) onStart(drill);
    } catch {
      if (id !== request.current) return;
      setError(
        "The arena could not load. Check your connection and try again.",
      );
    } finally {
      if (id === request.current) {
        starting.current = false;
        setPreparing(false);
      }
    }
  }

  return (
    <section
      className="rt-setup"
      hidden={!active}
      aria-label="Choose a practice mechanic"
    >
      {preparing &&
        createPortal(
          <dialog
            ref={loadingDialog}
            className="rt-preparing-dialog"
            aria-labelledby="rt-preparing-title"
            onCancel={cancelPreparation}
          >
            <div className="rt-preparing-panel">
              <div className="rt-preparing-heading">
                <span className="rt-preparing-eyebrow">Before the pull</span>
                <h2 id="rt-preparing-title">Preparing the encounter…</h2>
              </div>
              <p>
                Loading the arena and class icons.
                <br />
                You’ll be able to start in a moment.
              </p>
              <div
                className="rt-loading-progress"
                role="progressbar"
                aria-label="Loading encounter assets"
              >
                <span />
              </div>
              <button disabled>Start pull</button>
            </div>
            <button onClick={cancelPreparation}>
              Back to mechanic selection <kbd>ESC</kbd>
            </button>
          </dialog>,
          document.body,
        )}
      <header className="rt-setup-heading">
        <h1>Raid Trainer.</h1>
        <p>Choose a mechanic and start practicing.</p>
      </header>
      <div className="rt-quick-bar">
        <div className="rt-quick-field">
          <span id="rt-raid-label">Raid</span>
          <Select
            aria-labelledby="rt-raid-label"
            value={raid.id}
            disabled={preparing}
            onValueChange={(id) => {
              const next = trainingCatalog.find((entry) => entry.id === id)!;
              setRaidId(id);
              setEncounterId(next.encounters[0].id);
              setDrillId(next.encounters[0].drills[0].id);
              setError("");
            }}
          >
            {trainingCatalog.map((entry) => (
              <SelectOption key={entry.id} value={entry.id}>
                <span className="rt-quick-option">
                  <SelectionImage src={entry.image} />
                  <span>{entry.name}</span>
                </span>
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="rt-quick-field">
          <span id="rt-encounter-label">Encounter</span>
          <Select
            aria-labelledby="rt-encounter-label"
            value={encounter.id}
            disabled={preparing}
            onValueChange={(id) => {
              setEncounterId(id);
              setDrillId(
                raid.encounters.find((entry) => entry.id === id)!.drills[0].id,
              );
              setError("");
            }}
          >
            {raid.encounters.map((entry) => (
              <SelectOption key={entry.id} value={entry.id}>
                <span className="rt-quick-option">
                  <SelectionImage src={entry.portrait} round />
                  <span>{entry.name}</span>
                </span>
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="rt-quick-field">
          <span id="rt-mechanic-label">Mechanic</span>
          <Select
            aria-labelledby="rt-mechanic-label"
            value={drill.id}
            disabled={preparing}
            onValueChange={(id) => {
              setDrillId(id);
              setError("");
            }}
          >
            {encounter.drills.map((entry) => (
              <SelectOption key={entry.id} value={entry.id}>
                <span className="rt-quick-option">
                  <SelectionImage src={entry.icon} />
                  <span>{entry.name}</span>
                </span>
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="rt-quick-start">
          <span>
            {drill.simulation.duration} seconds ·{" "}
            {drill.simulation.timeline.length} casts · Focus mode
          </span>
          <button
            ref={startButtonRef}
            className="rt-start-game"
            disabled={preparing}
            aria-busy={preparing}
            onClick={() => void begin()}
          >
            {preparing ? (
              "Preparing arena…"
            ) : (
              <>
                Start game <kbd>ENTER</kbd>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
          {error && (
            <p className="rt-setup-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="rt-mechanic-overview">
        <div className="rt-mechanic-copy">
          <h2>{drill.name}</h2>
          <p>{drill.summary}</p>
          <div className="rt-mechanic-tags">
            <span className="rt-roles">{drill.roles}</span>
            <span>{drill.difficulties}</span>
            <span>{drill.phases}</span>
          </div>
          <div className="rt-mechanic-goal">
            <span>Your goal</span>
            <p>{drill.goal}</p>
          </div>
        </div>
        {drill.preview === "defile-placement" && (
          <PlacementPreview bossPortrait={encounter.portrait} />
        )}
      </div>
      <ol className="rt-mechanic-steps">
        {drill.steps.map(([title, description], index) => (
          <li key={title}>
            <span className="rt-step-number">{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer className="rt-setup-footer">
        <span>{raid.edition} · Movement and timer practice</span>
        <a href={drill.reference} target="_blank" rel="noreferrer">
          Mechanic reference <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </section>
  );
}

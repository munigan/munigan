"use client";
import { useState } from "react";
import type { Snapshot } from "@/domain/top-gear/model";
import { listSpecs } from "@/features/settings/registry";
import {
  parseExport,
  resolveSnapshot,
  applyBagImport,
  type ImportDraft,
} from "./parse-export";
export function ImportPanel({
  onResolved,
}: {
  onResolved: (snapshot: Snapshot) => void;
}) {
  const [kind, setKind] = useState<"character" | "profile">("character"),
    [character, setCharacter] = useState(""),
    [bags, setBags] = useState(""),
    [draft, setDraft] = useState<ImportDraft | null>(null),
    [preset, setPreset] = useState(""),
    [error, setError] = useState("");
  function review() {
    try {
      const next = parseExport(character, kind);
      if (bags.trim()) parseExport(bags, "bags");
      setDraft(next);
      setError("");
      const talents = (next.settingsJson.player as { talentsString?: string })
        ?.talentsString;
      setPreset(
        listSpecs().find(
          (s) =>
            s.classId === next.classId && s.talents.talentsString === talents,
        )?.id ?? "",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function select() {
    try {
      let { snapshot } = resolveSnapshot(draft!, preset);
      if (bags.trim())
        snapshot = applyBagImport(
          snapshot,
          parseExport(bags, "bags").inventory,
        );
      onResolved(snapshot);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="setup-layout">
      <div className="panel import-card">
        {!draft ? (
          <>
            <div className="section-top">
              <h2>Import your character</h2>
              <span className="badge">Level 80</span>
            </div>
            <div className="segmented">
              <button
                aria-pressed={kind === "character"}
                onClick={() => setKind("character")}
              >
                Addon export
              </button>
              <button
                aria-pressed={kind === "profile"}
                onClick={() => setKind("profile")}
              >
                Simulator profile
              </button>
            </div>
            <label htmlFor="character">
              {kind === "character" ? "Character export" : "Simulator profile"}
            </label>
            <textarea
              id="character"
              rows={7}
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              placeholder={
                kind === "character"
                  ? "Paste your /wse character export"
                  : "Paste a full Poli93 simulator JSON export or profile link"
              }
            />
            <label htmlFor="bags">Bag export</label>
            <p className="field-help">
              Optional · Equipped gear only if left empty.
            </p>
            <textarea
              id="bags"
              rows={4}
              value={bags}
              onChange={(e) => setBags(e.target.value)}
              placeholder="Paste your /wse bag export"
            />
            <button
              className="primary"
              onClick={review}
              disabled={!character.trim()}
            >
              Review import <span aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">IMPORT REVIEW</p>
            <h2>
              {String(
                (draft.settingsJson.player as { name?: string })?.name ??
                  "Your character",
              )}
            </h2>
            <div className="import-counts">
              <span>
                <strong>{draft.inventory.length}</strong> equipped items
              </span>
              <span>
                <strong>
                  {bags.trim() ? parseExport(bags, "bags").inventory.length : 0}
                </strong>{" "}
                bag items
              </span>
            </div>
            <label htmlFor="preset">DPS preset</label>
            <select
              id="preset"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="">Choose your specialization</option>
              {listSpecs()
                .filter((s) => s.classId === draft.classId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.className} · {s.name}
                  </option>
                ))}
            </select>
            <p className="muted">
              Imported settings are preserved. Missing settings use this
              simulator preset.
            </p>
            <div className="actions">
              <button onClick={() => setDraft(null)}>Back to import</button>
              <button className="primary" disabled={!preset} onClick={select}>
                Select gear <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </div>
      <aside className="import-help">
        <p className="eyebrow">FROM YOUR BAGS TO YOUR BEST SET</p>
        <h2>Bring the gear you own.</h2>
        <ol>
          <li>
            Install the Wrath{" "}
            <a
              href="https://github.com/Poli93/wowsimsexporter-wotlk-335"
              target="_blank"
              rel="noreferrer"
            >
              WowSims Exporter ↗
            </a>
            .
          </li>
          <li>
            In game, type <code>/wse</code> and copy your character.
          </li>
          <li>Export your bags and paste both here.</li>
        </ol>
        <p className="muted">
          Gems, enchants and duplicate copies stay exactly as imported.
        </p>
      </aside>
    </div>
  );
}

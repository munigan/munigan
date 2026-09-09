"use client";
import { useState } from "react";
import Image from "next/image";
import type { Snapshot } from "@/domain/top-gear/model";
import { validateItem } from "@/domain/equipment/validate";
import { Class, Profession } from "@/generated/wotlk/common";
import { ItemIcon } from "@/features/inventory/Item";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
import { listSpecs } from "@/features/settings/registry";
import {
  parseExport,
  resolveSnapshot,
  applyBagImport,
  type ImportDraft,
} from "./parse-export";
import "./import-refinements.css";

const professionIcons: Record<number, string> = {
  1: "trade_alchemy",
  2: "trade_blacksmithing",
  3: "trade_engraving",
  4: "trade_engineering",
  5: "trade_herbalism",
  6: "inv_inscription_tradeskill01",
  7: "inv_misc_gem_01",
  8: "trade_leatherworking",
  9: "trade_mining",
  10: "inv_misc_pelt_wolf_01",
  11: "trade_tailoring",
};
function ReviewIcon({ icon, size = 28 }: { icon: string; size?: number }) {
  return (
    <Image
      unoptimized
      src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
      width={size}
      height={size}
      alt=""
    />
  );
}
function imported(draft: ImportDraft, path: string) {
  let value: unknown = draft.settingsJson;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, part))
      return false;
    value = (value as Record<string, unknown>)[part];
  }
  return true;
}
function sourceLabel(draft: ImportDraft, paths: string[], ready: boolean) {
  const count = paths.filter((path) => imported(draft, path)).length;
  if (count === paths.length) return "Imported";
  if (count) return ready ? "Imported + preset" : "Imported + pending";
  return ready ? "Preset default" : "Choose a preset";
}
type Review = { snapshot: Snapshot; supported: number; unsupported: number };
export function ImportPanel({
  onResolved,
}: {
  onResolved: (snapshot: Snapshot) => void;
}) {
  const [kind, setKind] = useState<"character" | "profile">("character");
  const [character, setCharacter] = useState("");
  const [bags, setBags] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [bagDraft, setBagDraft] = useState<ImportDraft | null>(null);
  const [preset, setPreset] = useState("");
  const [resolved, setResolved] = useState<Review | null>(null);
  const [errors, setErrors] = useState<{
    character?: string;
    bags?: string;
    preset?: string;
  }>({});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  function resolve(next: ImportDraft, bag: ImportDraft | null, id: string) {
    setResolved(null);
    if (!id) return;
    try {
      const snapshot = applyBagImport(
        resolveSnapshot(next, id).snapshot,
        bag?.inventory ?? [],
      );
      const unsupported = (bag?.inventory ?? []).filter((item) =>
        validateItem(snapshot, item).some(
          (diagnostic) => diagnostic.severity === "error",
        ),
      ).length;
      setResolved({
        snapshot,
        supported: (bag?.inventory.length ?? 0) - unsupported,
        unsupported,
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        preset: (error as Error).message,
      }));
    }
  }
  function review() {
    const nextErrors: typeof errors = {};
    let next: ImportDraft | null = null,
      bag: ImportDraft | null = null;
    try {
      next = parseExport(character, kind);
    } catch (error) {
      nextErrors.character = (error as Error).message;
    }
    if (bags.trim()) {
      try {
        bag = parseExport(bags, "bags");
      } catch (error) {
        nextErrors.bags = (error as Error).message;
      }
    }
    setErrors(nextErrors);
    if (!next || Object.keys(nextErrors).length) return;
    const talents = (next.settingsJson.player as { talentsString?: string })
      ?.talentsString;
    const id =
      listSpecs().find(
        (spec) =>
          spec.classId === next.classId &&
          spec.talents.talentsString === talents,
      )?.id ?? "";
    setDraft(next);
    setBagDraft(bag);
    setPreset(id);
    resolve(next, bag, id);
  }
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText("/wse");
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  const className = draft
    ? Class[draft.classId ?? 0]
        .replace(/^Class/, "")
        .replace("Deathknight", "Death Knight")
    : "";
  const player = resolved?.snapshot.settings.player;
  const importedPlayer = draft?.settingsJson.player as
    Record<string, unknown> | undefined;
  const professions = [
    player?.profession1 ?? importedPlayer?.profession1,
    player?.profession2 ?? importedPlayer?.profession2,
  ]
    .map((value) =>
      typeof value === "string"
        ? Profession[value as keyof typeof Profession]
        : value,
    )
    .filter((value): value is number => typeof value === "number" && value > 0);
  return (
    <div className="import-refinement">
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
                onClick={() => {
                  setKind("character");
                  setErrors({});
                }}
              >
                Addon export
              </button>
              <button
                aria-pressed={kind === "profile"}
                onClick={() => {
                  setKind("profile");
                  setErrors({});
                }}
              >
                Simulator profile
              </button>
            </div>
            <div className="import-input-section">
              <div className="import-field-title">
                <span className="import-step" aria-hidden="true">
                  1
                </span>
                <label htmlFor="character">
                  {kind === "character"
                    ? "Character export"
                    : "Simulator profile"}
                </label>
                <span className="small muted">Required</span>
              </div>
              <textarea
                id="character"
                rows={5}
                value={character}
                aria-invalid={!!errors.character}
                aria-describedby={
                  errors.character ? "character-error" : undefined
                }
                onChange={(event) => {
                  setCharacter(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    character: undefined,
                  }));
                }}
                placeholder={
                  kind === "character"
                    ? "Paste your /wse character export"
                    : "Paste a full Poli93 simulator JSON export or profile link"
                }
              />
              {errors.character && (
                <p
                  id="character-error"
                  role="alert"
                  className="import-field-error"
                >
                  {errors.character}
                </p>
              )}
            </div>
            <div className="import-input-section">
              <div className="import-field-title">
                <span className="import-step" aria-hidden="true">
                  2
                </span>
                <label htmlFor="bags">Bag export</label>
                <span className="small muted">Optional</span>
              </div>
              <p id="bags-help" className="small muted">
                Leave empty to compare your equipped gear only.
              </p>
              <textarea
                id="bags"
                rows={3}
                value={bags}
                aria-invalid={!!errors.bags}
                aria-describedby={
                  errors.bags ? "bags-help bags-error" : "bags-help"
                }
                onChange={(event) => {
                  setBags(event.target.value);
                  setErrors((current) => ({ ...current, bags: undefined }));
                }}
                placeholder="Paste your /wse bag export"
              />
              {errors.bags && (
                <p id="bags-error" role="alert" className="import-field-error">
                  {errors.bags}
                </p>
              )}
            </div>
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
            <div className="import-identity">
              <ReviewIcon
                icon={`classicon_${className.toLowerCase().replaceAll(" ", "")}`}
                size={44}
              />
              <div>
                <h2>{String(importedPlayer?.name ?? "Your character")}</h2>
                <p className="muted">Level 80 · {className}</p>
              </div>
              <span className="badge">Character imported</span>
            </div>
            <div className="import-equipment">
              <div className="import-review-heading">
                <h3>Equipped gear</h3>
                <span className="muted small">
                  {draft.inventory.length} items · Gems & enchants preserved
                </span>
              </div>
              <ItemVersionContext value="original">
                <div
                  className="import-equipped-icons"
                  aria-label="Imported equipped gear"
                >
                  {draft.inventory.map((item) => (
                    <ItemIcon key={item.instanceId} item={item} size={38} />
                  ))}
                </div>
              </ItemVersionContext>
            </div>
            <div className="import-preset">
              <label htmlFor="preset">DPS preset</label>
              <select
                id="preset"
                value={preset}
                aria-invalid={!!errors.preset}
                aria-describedby="preset-help"
                onChange={(event) => {
                  const id = event.target.value;
                  setPreset(id);
                  setErrors({});
                  resolve(draft, bagDraft, id);
                }}
              >
                <option value="">Choose your specialization</option>
                {listSpecs()
                  .filter((spec) => spec.classId === draft.classId)
                  .map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.className} · {spec.name}
                    </option>
                  ))}
              </select>
              <p id="preset-help" className="small muted">
                Imported values are kept. The preset fills settings absent from
                your export.
              </p>
            </div>
            {errors.preset && (
              <p role="alert" className="import-field-error">
                {errors.preset}
              </p>
            )}
            <div className="import-bag-status" aria-label="Bag compatibility">
              <div>
                <strong>{bagDraft?.inventory.length ?? 0}</strong> bag items
              </div>
              {resolved ? (
                <p>
                  <span className="accent">{resolved.supported} supported</span>
                  <span aria-hidden="true"> · </span>
                  <span>{resolved.unsupported} unsupported</span>
                </p>
              ) : (
                <p className="small muted">
                  Choose a preset to check bag compatibility.
                </p>
              )}
              {!!resolved?.unsupported && (
                <p className="small muted">
                  Unsupported items stay visible in your bags and cannot be
                  selected.
                </p>
              )}
            </div>
            <div className="import-review-heading">
              <h3>Settings</h3>
              <span className="small muted">Editable after import</span>
            </div>
            <dl className="import-setting-sources">
              {[
                ["Talents", ["player.talentsString"]],
                ["Glyphs", ["player.glyphs"]],
                [
                  "Buffs",
                  ["raidBuffs", "partyBuffs", "debuffs", "player.buffs"],
                ],
                ["Consumables", ["player.consumes"]],
                ["Encounter", ["encounter"]],
                ["Professions", ["player.profession1", "player.profession2"]],
              ].map(([label, paths]) => (
                <div key={label as string}>
                  <dt>{label}</dt>
                  <dd>{sourceLabel(draft, paths as string[], !!resolved)}</dd>
                </div>
              ))}
            </dl>
            {professions.length > 0 && (
              <div className="import-professions">
                {professions.map((profession, index) => (
                  <div key={`${profession}-${index}`}>
                    <ReviewIcon
                      icon={
                        professionIcons[profession] ?? "inv_misc_questionmark"
                      }
                    />
                    <span>
                      {Profession[profession]}
                      <small>
                        {draft.professionLevels?.[profession]
                          ? `${draft.professionLevels[profession]} / 450`
                          : "Rank not exported · assumes 450"}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="actions">
              <button
                onClick={() => {
                  setDraft(null);
                  setResolved(null);
                  setErrors({});
                }}
              >
                Back to import
              </button>
              <button
                className="primary"
                disabled={!resolved}
                onClick={() => resolved && onResolved(resolved.snapshot)}
              >
                Select gear <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </div>
      <details className="import-addon-help">
        <summary>How to get your exports</summary>
        <div>
          <p>
            Install{" "}
            <a
              href="https://github.com/Poli93/wowsimsexporter-wotlk-335"
              target="_blank"
              rel="noreferrer"
            >
              WowSims Exporter for Wrath ↗
            </a>
            , then open it in game:
          </p>
          <div className="import-command">
            <code>/wse</code>
            <button onClick={copyCommand}>
              {copyState === "copied" ? "Copied!" : "Copy /wse"}
            </button>
          </div>
          {copyState === "failed" && (
            <p role="alert" className="import-field-error">
              Clipboard unavailable. Copy /wse manually.
            </p>
          )}
          {copyState === "copied" && (
            <span role="status" className="small muted">
              Command copied.
            </span>
          )}
          <p>
            Copy the character export first, then the bag export. Paste each
            into its matching field above.
          </p>
        </div>
      </details>
    </div>
  );
}

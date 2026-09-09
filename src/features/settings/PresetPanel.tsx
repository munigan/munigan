"use client";
import { useEffect, useRef, useState } from "react";
import type { JsonObject } from "@protobuf-ts/runtime";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import { APLRotation, APLRotation_Type } from "@/generated/wotlk/apl";
import { Profession } from "@/generated/wotlk/common";
import {
  BuffControls,
  ConsumeControls,
  GlyphControls,
  SettingIcon,
  professionIcons,
} from "./VisualSettings";
import "./settings-refinements.css";
import { defaultSettings, getSpec, listSpecs, modules } from "./registry";
import { applySettingsPatch } from "@/features/import/parse-export";
import type { Snapshot } from "@/domain/top-gear/model";
const categories = [
  "Encounter",
  "Talents & glyphs",
  "Rotation",
  "Buffs",
  "Consumes",
  "Professions",
  "Advanced",
] as const;
export function PresetPanel({
  snapshot,
  onChange,
  onClose,
}: {
  snapshot: Snapshot;
  onChange: (s: Snapshot) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] =
      useState<(typeof categories)[number]>("Encounter"),
    [error, setError] = useState(""),
    [text, setText] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const spec = getSpec(snapshot.specId),
    defaults = defaultSettings(spec.id),
    p = snapshot.settings.player!,
    encounter = snapshot.settings.encounter!;
  const json = IndividualSimSettings.toJson(snapshot.settings) as JsonObject,
    def = IndividualSimSettings.toJson(defaults) as JsonObject;
  function close() {
    dialog.current?.close();
    onClose();
  }
  function patch(value: JsonObject) {
    try {
      onChange(applySettingsPatch(snapshot, value));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function categoryJson(name: string, from: JsonObject = json): JsonObject {
    const player = from.player as JsonObject;
    switch (name) {
      case "Talents & glyphs":
        return {
          player: {
            talentsString: player.talentsString ?? "",
            glyphs: player.glyphs ?? {},
          },
        };
      case "Buffs":
        return {
          raidBuffs: from.raidBuffs ?? {},
          partyBuffs: from.partyBuffs ?? {},
          debuffs: from.debuffs ?? {},
          player: { buffs: player.buffs ?? {} },
        };
      case "Consumes":
        return { player: { consumes: player.consumes ?? {} } };
      default:
        return from;
    }
  }
  function openCategory(c: typeof category) {
    setCategory(c);
    setText(JSON.stringify(categoryJson(c), null, 2));
    setError("");
  }
  const categoryPrefixes: Record<string, string[]> = {
    Encounter: ["encounter"],
    Buffs: ["raidBuffs", "partyBuffs", "debuffs", "player.buffs"],
    Consumes: ["player.consumes"],
    "Talents & glyphs": ["player.talentsString", "player.glyphs"],
    Professions: ["player.profession1", "player.profession2"],
    Rotation: ["player.rotation"],
  };
  function categoryProvenance(name: string, source: "preset" | "edited") {
    const prefixes = categoryPrefixes[name] ?? [];
    return {
      ...Object.fromEntries(
        Object.entries(snapshot.provenance).filter(
          ([path]) =>
            !prefixes.some(
              (prefix) => path === prefix || path.startsWith(prefix + "."),
            ),
        ),
      ),
      ...Object.fromEntries(prefixes.map((path) => [path, source])),
    };
  }
  const sources = Object.entries(snapshot.provenance)
    .filter(([path]) =>
      (categoryPrefixes[category] ?? []).some(
        (prefix) => path === prefix || path.startsWith(prefix + "."),
      ),
    )
    .map(([, source]) => source);
  const sourceLabel = sources.includes("edited")
    ? "Edited"
    : sources.includes("imported")
      ? "Imported"
      : "Default";
  function encounterPreset(targetCount: number, duration: number) {
    const current = (json.encounter as JsonObject).targets as JsonObject[];
    patch({
      encounter: {
        duration,
        durationVariation: Math.min(encounter.durationVariation, duration / 2),
        targets: Array.from(
          { length: targetCount },
          (_, i) => current[i] ?? current[0],
        ),
      },
    });
  }
  function resetCategory() {
    const saved = IndividualSimSettings.clone(snapshot.settings);
    if (category === "Encounter") saved.encounter = defaults.encounter;
    else if (category === "Buffs") {
      saved.raidBuffs = defaults.raidBuffs;
      saved.partyBuffs = defaults.partyBuffs;
      saved.debuffs = defaults.debuffs;
      saved.player!.buffs = defaults.player!.buffs;
    } else if (category === "Consumes")
      saved.player!.consumes = defaults.player!.consumes;
    else if (category === "Talents & glyphs") {
      saved.player!.talentsString = defaults.player!.talentsString;
      saved.player!.glyphs = defaults.player!.glyphs;
    }
    onChange({
      ...snapshot,
      settings: saved,
      provenance: categoryProvenance(category, "preset"),
    });
    setText(JSON.stringify(categoryJson(category, def), null, 2));
  }
  const rotationPresets = Object.entries(modules[spec.module].presets).filter(
    ([, v]) => v.rotation?.rotation,
  );
  function chooseRotation(value: string) {
    if (value === "auto") {
      patch({ player: { rotation: { type: "TypeAuto" } } });
      return;
    }
    const rotation = rotationPresets.find(([key]) => key === value)?.[1]
      .rotation?.rotation;
    if (rotation)
      patch({
        player: {
          rotation: APLRotation.toJson(
            APLRotation.create(rotation as APLRotation),
          ),
        },
      });
  }
  return (
    <dialog
      ref={dialog}
      className="settings-dialog simulation-dialog"
      aria-labelledby="simulation-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="section-top simulation-dialog-header">
        <div>
          <p className="eyebrow">SIMULATION</p>
          <h2 id="simulation-dialog-title">Buffs & settings</h2>
        </div>
        <button onClick={close}>Done</button>
      </div>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings categories"
      >
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            id={`settings-tab-${categories.indexOf(c)}`}
            aria-controls="settings-panel"
            tabIndex={category === c ? 0 : -1}
            onKeyDown={(event) => {
              const i = categories.indexOf(c);
              const index =
                event.key === "ArrowRight"
                  ? (i + 1) % categories.length
                  : event.key === "ArrowLeft"
                    ? (i + categories.length - 1) % categories.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? categories.length - 1
                        : -1;
              if (index >= 0) {
                event.preventDefault();
                openCategory(categories[index]);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [index]?.focus();
              }
            }}
            aria-selected={category === c}
            onClick={() => openCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div
        className="settings-body"
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${categories.indexOf(category)}`}
      >
        <div className="section-top">
          <h3>
            {category}{" "}
            {category !== "Advanced" && (
              <span className="badge settings-source">{sourceLabel}</span>
            )}
          </h3>
          {["Encounter", "Buffs", "Consumes", "Talents & glyphs"].includes(
            category,
          ) && (
            <button className="text-button" onClick={resetCategory}>
              Simulator default
            </button>
          )}
        </div>
        {category === "Encounter" && (
          <>
            <div
              className="encounter-presets segmented"
              aria-label="Encounter shortcuts"
            >
              <button onClick={() => encounterPreset(1, 180)}>
                Single target · 3 min
              </button>
              <button onClick={() => encounterPreset(3, 180)}>
                Cleave · 3 targets
              </button>
              <button onClick={() => encounterPreset(1, 60)}>
                Short fight · 1 min
              </button>
            </div>
            <div className="form-grid">
              <label>
                Fight length (seconds)
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={encounter.duration}
                  onChange={(e) =>
                    patch({ encounter: { duration: Number(e.target.value) } })
                  }
                />
              </label>
              <label>
                Duration variation (seconds)
                <input
                  type="number"
                  min={0}
                  max={encounter.duration / 2}
                  value={encounter.durationVariation}
                  onChange={(e) =>
                    patch({
                      encounter: { durationVariation: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Targets
                <select
                  value={encounter.targets.length}
                  onChange={(e) =>
                    patch({
                      encounter: {
                        targets: Array.from(
                          { length: Number(e.target.value) },
                          (_, i) =>
                            (json.encounter as JsonObject).targets instanceof
                            Array
                              ? ((
                                  (json.encounter as JsonObject)
                                    .targets as JsonObject[]
                                )[i] ??
                                (
                                  (json.encounter as JsonObject)
                                    .targets as JsonObject[]
                                )[0])
                              : {},
                        ),
                      },
                    })
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              Target stats and other imported encounter settings are preserved.
            </p>
          </>
        )}
        {category === "Rotation" && (
          <>
            <label>
              Rotation preset
              <select
                value={
                  p.rotation?.type === APLRotation_Type.TypeAPL
                    ? "custom"
                    : "auto"
                }
                onChange={(e) => chooseRotation(e.target.value)}
              >
                <option value="auto">
                  Automatic · simulator recommendation
                </option>
                <option value="custom" disabled>
                  Imported / selected APL
                </option>
                {rotationPresets.map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Automatic rotation follows the pinned simulator and your current
              talents, targets and gear.
            </p>
          </>
        )}
        {category === "Professions" && (
          <div className="form-grid">
            {(["profession1", "profession2"] as const).map((field, index) => (
              <label key={field}>
                Profession {index + 1}
                <span className="profession-input">
                  <SettingIcon
                    key={p[field]}
                    icon={professionIcons[p[field]]}
                  />
                  <select
                    value={p[field]}
                    onChange={(e) =>
                      patch({ player: { [field]: Number(e.target.value) } })
                    }
                  >
                    {Object.entries(Profession)
                      .filter(([, v]) => typeof v === "number")
                      .map(([name, v]) => (
                        <option key={name} value={v}>
                          {name === "ProfessionUnknown" ? "None" : name}
                        </option>
                      ))}
                  </select>
                </span>
                {snapshot.professionLevels?.[String(p[field])] !==
                  undefined && (
                  <small className="muted">
                    Imported rank: {snapshot.professionLevels[String(p[field])]}{" "}
                    / 450
                  </small>
                )}
              </label>
            ))}
          </div>
        )}
        {category === "Buffs" && (
          <div className="actions">
            <button
              onClick={() => {
                const settings = IndividualSimSettings.clone(snapshot.settings);
                settings.raidBuffs = undefined;
                settings.partyBuffs = undefined;
                settings.debuffs = undefined;
                settings.player!.buffs = undefined;
                onChange({
                  ...snapshot,
                  settings,
                  provenance: categoryProvenance("Buffs", "edited"),
                });
                setText(
                  JSON.stringify(
                    {
                      raidBuffs: {},
                      partyBuffs: {},
                      debuffs: {},
                      player: { buffs: {} },
                    },
                    null,
                    2,
                  ),
                );
              }}
            >
              No external buffs
            </button>
          </div>
        )}
        {category === "Talents & glyphs" && (
          <>
            <label>
              Talent preset
              <select
                aria-label="Talent preset"
                value={
                  p.talentsString === spec.talents.talentsString
                    ? snapshot.specId
                    : "imported"
                }
                onChange={(e) => {
                  const chosen = getSpec(e.target.value);
                  const settings = IndividualSimSettings.clone(
                    snapshot.settings,
                  );
                  settings.player!.talentsString = chosen.talents.talentsString;
                  settings.player!.glyphs = structuredClone(
                    chosen.talents.glyphs,
                  );
                  onChange({
                    ...snapshot,
                    specId: chosen.id,
                    settings,
                    provenance: categoryProvenance(
                      "Talents & glyphs",
                      "preset",
                    ),
                  });
                }}
              >
                <option value="imported" disabled>
                  Imported talents
                </option>
                {listSpecs()
                  .filter((s) => s.module === spec.module)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <GlyphControls snapshot={snapshot} onPatch={patch} />
            <details className="talent-string">
              <summary>Talent string</summary>
              <label>
                Talent string
                <input
                  aria-label="Talent string"
                  value={p.talentsString}
                  onChange={(e) =>
                    patch({ player: { talentsString: e.target.value } })
                  }
                />
              </label>
            </details>
          </>
        )}
        {category === "Buffs" && (
          <BuffControls snapshot={snapshot} onPatch={patch} />
        )}
        {category === "Consumes" && (
          <ConsumeControls snapshot={snapshot} onPatch={patch} />
        )}
        {category === "Advanced" && (
          <details className="advanced-settings" open>
            <summary>Advanced simulator configuration</summary>
            <label htmlFor="config-json">{category} JSON</label>
            <textarea
              id="config-json"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <button
              onClick={() => {
                try {
                  const parsed = JSON.parse(text);
                  if (
                    !parsed ||
                    Array.isArray(parsed) ||
                    typeof parsed !== "object"
                  )
                    throw new Error("Use a JSON object");
                  patch(parsed);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Apply configuration
            </button>
          </details>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

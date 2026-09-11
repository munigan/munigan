"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { JsonObject } from "@protobuf-ts/runtime";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
} from "@/components/ui/Dialog";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AlertMessage } from "@/components/ui/Alert";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { applySettingsPatch } from "@/features/import/parse-export";
import type { Snapshot } from "@/domain/top-gear/model";
import { defaultSettings, getSpec, listSpecs } from "./registry";
import { validateTalents } from "./talents";
import { BuffControls, ConsumeControls, GlyphControls } from "./VisualSettings";
import {
  SettingsNavigation,
  categoryKeys,
  type SettingsCategory,
} from "./SettingsNavigation";
import { EncounterSettings } from "./EncounterSettings";
import { AdvancedSettings } from "./AdvancedSettings";
import { ProfessionSettings } from "./ProfessionSettings";
import { RotationSettings } from "./RotationSettings";
import { SettingsIcon } from "./SettingsIcon";
import "./settings-refinements.css";
const prefixes: Partial<Record<SettingsCategory, string[]>> = {
  Encounter: ["encounter"],
  Buffs: ["raidBuffs", "partyBuffs", "debuffs", "player.buffs"],
  Consumes: ["player.consumes"],
  "Talents & glyphs": ["player.talentsString", "player.glyphs"],
  Professions: ["player.profession1", "player.profession2"],
  Rotation: ["player.rotation"],
};
function provenance(
  snapshot: Snapshot,
  category: SettingsCategory,
  source: "preset" | "edited",
) {
  const paths = prefixes[category] ?? [];
  return {
    ...Object.fromEntries(
      Object.entries(snapshot.provenance).filter(
        ([path]) => !paths.some((p) => path === p || path.startsWith(p + ".")),
      ),
    ),
    ...Object.fromEntries(paths.map((p) => [p, source])),
  };
}
function validateDraft(snapshot: Snapshot) {
  const p = snapshot.settings.player,
    e = snapshot.settings.encounter;
  if (!p || !e) throw new Error("A player and encounter are required");
  if (p.class !== getSpec(snapshot.specId).classId)
    throw new Error("Class does not match specialization");
  if (
    !Number.isFinite(e.duration) ||
    !Number.isFinite(e.durationVariation) ||
    e.useHealth ||
    e.duration < 10 ||
    e.duration > 600 ||
    e.durationVariation < 0 ||
    e.durationVariation > e.duration / 2 ||
    e.targets.length < 1 ||
    e.targets.length > 10
  )
    throw new Error("Use a 10–600 second encounter with 1–10 targets");
  if (
    e.targets.some(
      (target) =>
        target.level < 80 ||
        target.level > 83 ||
        target.stats.some(
          (v) => !Number.isFinite(v) || Math.abs(v) > 1000000000000,
        ),
    )
  )
    throw new Error("Invalid target configuration");
  if (p.profession1 && p.profession1 === p.profession2)
    throw new Error("Choose two different professions");
  const errors = validateTalents(snapshot);
  if (errors.length) throw new Error(errors[0]);
}
export function PresetPanel({
  snapshot: initial,
  onChange,
  onClose,
}: {
  snapshot: Snapshot;
  onChange: (s: Snapshot) => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings"),
    d = useTranslations("diagnostics");
  const [snapshot, setSnapshot] = useState(initial),
    [category, setCategory] = useState<SettingsCategory>("Encounter"),
    [error, setError] = useState<unknown>(null),
    [text, setText] = useState<string | null>(null),
    [discard, setDiscard] = useState(false),
    [validated, setValidated] = useState(false);
  const spec = getSpec(snapshot.specId),
    p = snapshot.settings.player!,
    encounter = snapshot.settings.encounter!;
  const json = IndividualSimSettings.toJson(snapshot.settings) as JsonObject;
  const dirty =
    JSON.stringify(snapshot) !== JSON.stringify(initial) || text !== null;
  const sources = Object.entries(snapshot.provenance)
    .filter(([path]) =>
      (prefixes[category] ?? []).some(
        (p) => path === p || path.startsWith(p + "."),
      ),
    )
    .map(([, s]) => s);
  const sourceLabel = t(
    sources.includes("edited")
      ? "source.edited"
      : sources.includes("imported")
        ? "source.imported"
        : "source.default",
  );
  function patch(value: JsonObject) {
    try {
      setSnapshot(applySettingsPatch(snapshot, value));
      setError(null);
      setValidated(false);
    } catch (e) {
      setError(e);
    }
  }
  function stageJson(): Snapshot | null {
    if (text === null) return snapshot;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
        throw new Error(t("advanced.object"));
      const next = applySettingsPatch(snapshot, parsed);
      validateDraft(next);
      setSnapshot(next);
      setText(null);
      setError(null);
      setValidated(true);
      return next;
    } catch (e) {
      setError(e);
      return null;
    }
  }
  function openCategory(next: SettingsCategory) {
    if (text !== null && !stageJson()) return;
    setCategory(next);
    setError(null);
  }
  function resetCategory() {
    const defaults = defaultSettings(spec.id),
      settings = IndividualSimSettings.clone(snapshot.settings);
    if (category === "Encounter") settings.encounter = defaults.encounter;
    if (category === "Buffs") {
      settings.raidBuffs = defaults.raidBuffs;
      settings.partyBuffs = defaults.partyBuffs;
      settings.debuffs = defaults.debuffs;
      settings.player!.buffs = defaults.player!.buffs;
    }
    if (category === "Consumes")
      settings.player!.consumes = defaults.player!.consumes;
    if (category === "Talents & glyphs") {
      settings.player!.talentsString = defaults.player!.talentsString;
      settings.player!.glyphs = defaults.player!.glyphs;
    }
    if (category === "Rotation")
      settings.player!.rotation = defaults.player!.rotation;
    setSnapshot({
      ...snapshot,
      settings,
      provenance: provenance(snapshot, category, "preset"),
    });
    setError(null);
  }
  function clearBuffs() {
    const settings = IndividualSimSettings.clone(snapshot.settings);
    settings.raidBuffs = undefined;
    settings.partyBuffs = undefined;
    settings.debuffs = undefined;
    settings.player!.buffs = undefined;
    setSnapshot({
      ...snapshot,
      settings,
      provenance: provenance(snapshot, "Buffs", "edited"),
    });
  }
  function requestClose() {
    if (dirty) setDiscard(true);
    else onClose();
  }
  function apply() {
    const next = stageJson();
    if (!next) return;
    try {
      validateDraft(next);
      onChange(next);
      onClose();
    } catch (e) {
      setError(e);
    }
  }
  function targets(count: number, duration?: number) {
    const current = (json.encounter as JsonObject).targets as JsonObject[];
    patch({
      encounter: {
        ...(duration
          ? {
              duration,
              durationVariation: Math.min(
                encounter.durationVariation,
                duration / 2,
              ),
            }
          : {}),
        targets: Array.from(
          { length: count },
          (_, i) => current[i] ?? current[0],
        ),
      },
    });
  }
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent className="settings-dialog simulation-dialog max-w-[1200px] overflow-hidden p-0!">
        <header className="simulation-dialog-header">
          <div>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </div>
          <div className="settings-header-actions">
            <span className="badge">WotLK 3.3.5a</span>
            <DialogDismiss />
          </div>
        </header>
        <SettingsNavigation
          value={category}
          onChange={openCategory}
          snapshot={snapshot}
        >
          <div className="settings-content-heading">
            <div>
              <h3>
                {t(`categories.${categoryKeys[category]}`)}
                {category !== "Advanced" && (
                  <span className="badge settings-source">{sourceLabel}</span>
                )}
              </h3>
              <p>{t(`descriptions.${categoryKeys[category]}`)}</p>
            </div>
            {[
              "Encounter",
              "Buffs",
              "Consumes",
              "Talents & glyphs",
              "Rotation",
            ].includes(category) && (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10 text-sm"
                onClick={resetCategory}
              >
                {t("reset")}
                <SettingsIcon name="rotation" />
              </Button>
            )}
          </div>
          {category === "Encounter" && (
            <EncounterSettings
              encounter={encounter}
              onPreset={(n, s) => targets(n, s)}
              onDurationChange={(duration) =>
                patch({
                  encounter: {
                    duration,
                    durationVariation: Math.min(
                      encounter.durationVariation,
                      duration / 2,
                    ),
                  },
                })
              }
              onVariationChange={(durationVariation) =>
                patch({ encounter: { durationVariation } })
              }
              onTargetsChange={(n) => targets(n)}
            />
          )}
          {category === "Talents & glyphs" && (
            <>
              <label className="settings-field">
                {t("talents.preset")}
                <Select
                  aria-label={t("talents.preset")}
                  value={
                    p.talentsString === spec.talents.talentsString
                      ? snapshot.specId
                      : "imported"
                  }
                  onValueChange={(v) => {
                    const chosen = getSpec(v),
                      settings = IndividualSimSettings.clone(snapshot.settings);
                    settings.player!.talentsString =
                      chosen.talents.talentsString;
                    settings.player!.glyphs = structuredClone(
                      chosen.talents.glyphs,
                    );
                    setSnapshot({
                      ...snapshot,
                      specId: chosen.id,
                      settings,
                      provenance: provenance(
                        snapshot,
                        "Talents & glyphs",
                        "preset",
                      ),
                    });
                  }}
                >
                  <SelectOption value="imported" disabled>
                    {t("talents.imported")}
                  </SelectOption>
                  {listSpecs()
                    .filter((s) => s.module === spec.module)
                    .map((s) => (
                      <SelectOption key={s.id} value={s.id}>
                        {s.name}
                      </SelectOption>
                    ))}
                </Select>
              </label>
              <p className="settings-note">{t("talents.replaces")}</p>
              <GlyphControls snapshot={snapshot} onPatch={patch} />
              <details className="settings-disclosure talent-string">
                <summary>{t("talents.string")}</summary>
                <label className="settings-field">
                  {t("talents.string")}
                  <input
                    aria-label={t("talents.string")}
                    value={p.talentsString}
                    onChange={(e) =>
                      patch({ player: { talentsString: e.target.value } })
                    }
                  />
                </label>
              </details>
            </>
          )}
          {category === "Rotation" && (
            <RotationSettings snapshot={snapshot} onPatch={patch} />
          )}
          {category === "Buffs" && (
            <BuffControls
              snapshot={snapshot}
              onPatch={patch}
              onClear={clearBuffs}
            />
          )}
          {category === "Consumes" && (
            <ConsumeControls
              key={`${p.consumes?.flask ? "flask" : p.consumes?.battleElixir || p.consumes?.guardianElixir ? "elixir" : "none"}`}
              snapshot={snapshot}
              onPatch={patch}
            />
          )}
          {category === "Professions" && (
            <ProfessionSettings
              snapshot={snapshot}
              onPatch={patch}
              onChange={setSnapshot}
            />
          )}
          {category === "Advanced" && (
            <AdvancedSettings
              value={text ?? JSON.stringify(json, null, 2)}
              onChange={(v) => {
                setText(v);
                setValidated(false);
                setError(null);
              }}
              onApply={() => {
                if (text === null) {
                  try {
                    validateDraft(snapshot);
                    setValidated(true);
                  } catch (e) {
                    setError(e);
                  }
                } else stageJson();
              }}
              validated={validated}
            />
          )}
          {error != null && (
            <AlertMessage tone="error">
              {localizeDiagnostic(error, d)}
            </AlertMessage>
          )}
        </SettingsNavigation>
        <footer className="settings-footer">
          <span>
            <SettingsIcon name="info" />
            {t("footerHelp")}
          </span>
          <div>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10 text-sm max-[359px]:px-2 max-[359px]:text-xs"
              onClick={requestClose}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              className="min-h-10 text-sm max-[359px]:px-2 max-[359px]:text-xs"
              disabled={error != null}
              onClick={apply}
            >
              {t("apply")}
              <SettingsIcon name="check" />
            </Button>
          </div>
        </footer>
        <DialogRoot open={discard} onOpenChange={setDiscard}>
          <DialogContent className="settings-discard-dialog">
            <DialogTitle>{t("discardTitle")}</DialogTitle>
            <DialogDescription>{t("discardHelp")}</DialogDescription>
            <div className="actions">
              <Button variant="secondary" onClick={() => setDiscard(false)}>
                {t("keepEditing")}
              </Button>
              <Button onClick={onClose}>{t("discard")}</Button>
            </div>
          </DialogContent>
        </DialogRoot>
      </DialogContent>
    </DialogRoot>
  );
}

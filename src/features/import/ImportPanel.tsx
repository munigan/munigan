"use client";
import { describeError, type ErrorDescriptor } from "@/i18n/error";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useTranslations } from "next-intl";
import { AlertMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type Ref,
} from "react";
import type { Snapshot } from "@/domain/top-gear/model";
import { validateItem } from "@/domain/equipment/validate";
import { listSpecs } from "@/features/settings/registry";
import {
  parseExport,
  resolveSnapshot,
  applyBagImport,
  type ImportDraft,
} from "./parse-export";
import "./import-refinements.css";
import { ImportReview, type Review } from "./ImportReview";
import { ImportInstructions } from "./ImportInstructions";
import { ExportPreview } from "./ExportPreview";
import { WarmaneFields } from "./WarmaneFields";
import {
  validateWarmaneLookup,
  type WarmaneImportFailure,
  type WarmaneImportMeta,
  type WarmaneImportMode,
} from "./warmane";
import {
  WarmaneImportStatus,
  WarmaneSavedProfileOffer,
} from "./WarmaneImportStatus";
import {
  isWarmaneImportMeta,
  savedProfileRetrievedAt,
} from "./warmane-import-meta";

import {
  importFormDraftKey,
  loadImportFormDraft,
  type ImportFormDraft,
} from "./import-form-draft";

export type ImportPanelHandle = {
  saveForLater: () => void;
  restoreDraft: () => boolean;
};

export function ImportPanel({
  ref,
  onResolved,
}: {
  ref?: Ref<ImportPanelHandle>;
  onResolved: (snapshot: Snapshot) => void;
}) {
  const t = useTranslations("import");
  const td = useTranslations("diagnostics");
  const [kind, setKind] = useState<"character" | "profile" | "warmane">(
    "character",
  );
  const [armory, setArmory] = useState({ name: "", realm: "Icecrown" });
  const [pending, setPending] = useState(false);
  const armoryRequest = useRef<AbortController | null>(null);
  useEffect(() => () => armoryRequest.current?.abort(), []);
  const [character, setCharacter] = useState("");
  const [bags, setBags] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [bagDraft, setBagDraft] = useState<ImportDraft | null>(null);
  const [preset, setPreset] = useState("");
  const presetRef = useRef("");
  const [resolved, setResolved] = useState<Review | null>(null);
  const [armoryMeta, setArmoryMeta] = useState<WarmaneImportMeta | null>(null);
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<ErrorDescriptor | null>(
    null,
  );
  const [errors, setErrors] = useState<{
    character?: ErrorDescriptor;
    bags?: ErrorDescriptor;
    preset?: ErrorDescriptor;
  }>({});
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
        preset: describeError(error),
      }));
    }
  }
  useImperativeHandle(ref, () => ({
    saveForLater() {
      if (!character.trim() && !bags.trim() && !armory.name.trim()) return;
      const saved: ImportFormDraft = {
        kind,
        character,
        bags,
        armory,
        preset,
        reviewing: !!draft,
        ...(kind === "warmane" && draft && armoryMeta ? { armoryMeta } : {}),
      };
      localStorage.setItem(importFormDraftKey, JSON.stringify(saved));
    },
    restoreDraft() {
      stopArmoryRequest();
      const saved = loadImportFormDraft();
      if (!saved) return false;
      // Re-parse the saved source through the same validation as a new import.
      const next = saved.reviewing
        ? parseExport(
            saved.character,
            saved.kind === "profile" ? "profile" : "character",
          )
        : null;
      const bag =
        next && saved.bags.trim() ? parseExport(saved.bags, "bags") : null;
      setKind(saved.kind);
      setCharacter(saved.character);
      setBags(saved.bags);
      setArmory(saved.armory);
      setPreset(saved.preset);
      presetRef.current = saved.preset;
      setDraft(next);
      setBagDraft(bag);
      setArmoryMeta(
        saved.kind === "warmane" && saved.reviewing
          ? (saved.armoryMeta ?? null)
          : null,
      );
      setSavedProfile(null);
      setRefreshError(null);
      setErrors({});
      if (next) resolve(next, bag, saved.preset);
      return true;
    },
  }));

  function stopArmoryRequest() {
    armoryRequest.current?.abort();
    armoryRequest.current = null;
    setPending(false);
  }

  function describeWarmaneFailure(value: unknown): ErrorDescriptor {
    const described = describeError(value);
    const retryAfterSeconds =
      value && typeof value === "object"
        ? (value as Partial<WarmaneImportFailure>).retryAfterSeconds
        : undefined;
    if (
      typeof retryAfterSeconds === "number" &&
      Number.isFinite(retryAfterSeconds)
    )
      return {
        ...described,
        params: { ...described.params, seconds: retryAfterSeconds },
      };
    if (described.code) return described;
    return {
      code: "warmaneUnavailable",
      message:
        "Warmane Armory is unavailable or limiting requests. Try again shortly, or use an addon export.",
    };
  }

  async function requestArmory(
    mode: WarmaneImportMode,
    surface: "import" | "review",
  ): Promise<ImportDraft | null> {
    const lookup = validateWarmaneLookup(armory);
    armoryRequest.current?.abort();
    const controller = new AbortController();
    armoryRequest.current = controller;
    setPending(true);
    setSavedProfile(null);
    if (surface === "import") setErrors({});
    else setRefreshError(null);
    try {
      const response = await fetch(
        `/api/import/warmane?${new URLSearchParams({ ...lookup, mode })}`,
        { signal: controller.signal },
      );
      const result: unknown = await response.json();
      if (controller.signal.aborted || armoryRequest.current !== controller)
        return null;
      if (!response.ok) {
        const described = describeWarmaneFailure(result);
        if (surface === "review") setRefreshError(described);
        else {
          setErrors({ character: described });
          setSavedProfile(savedProfileRetrievedAt(result));
        }
        return null;
      }
      const payload = result as { character?: unknown; meta?: unknown };
      const exported = JSON.stringify(payload.character);
      const next = parseExport(exported, "character");
      if (controller.signal.aborted || armoryRequest.current !== controller)
        return null;
      setCharacter(exported);
      setArmoryMeta(isWarmaneImportMeta(payload.meta) ? payload.meta : null);
      setErrors({});
      setRefreshError(null);
      return next;
    } catch (error) {
      if (controller.signal.aborted || armoryRequest.current !== controller)
        return null;
      const described = describeWarmaneFailure(error);
      if (surface === "review") setRefreshError(described);
      else setErrors({ character: described });
      return null;
    } finally {
      if (armoryRequest.current === controller) {
        armoryRequest.current = null;
        setPending(false);
      }
    }
  }

  async function review(mode: WarmaneImportMode = "auto") {
    if (pending) return;
    const nextErrors: typeof errors = {};
    let next: ImportDraft | null = null,
      bag: ImportDraft | null = null;
    if (bags.trim()) {
      try {
        bag = parseExport(bags, "bags");
      } catch (error) {
        nextErrors.bags = describeError(error);
      }
    }
    if (kind === "warmane") {
      if (nextErrors.bags) {
        setErrors(nextErrors);
        return;
      }
      try {
        next = await requestArmory(mode, "import");
      } catch (error) {
        nextErrors.character = describeWarmaneFailure(error);
      }
    } else {
      try {
        next = parseExport(character, kind);
      } catch (error) {
        nextErrors.character = describeError(error);
      }
    }
    if (!next || Object.keys(nextErrors).length) {
      if (Object.keys(nextErrors).length) setErrors(nextErrors);
      return;
    }
    setErrors({});
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
    presetRef.current = id;
    resolve(next, bag, id);
  }

  async function refreshArmory() {
    if (pending || kind !== "warmane" || !draft) return;
    let next: ImportDraft | null = null;
    try {
      next = await requestArmory("refresh", "review");
    } catch (error) {
      setRefreshError(describeWarmaneFailure(error));
    }
    if (!next) return;
    setDraft(next);
    resolve(next, bagDraft, presetRef.current);
  }

  function changeKind(next: "character" | "profile" | "warmane") {
    stopArmoryRequest();
    setKind(next);
    setErrors({});
    setSavedProfile(null);
    setArmoryMeta(null);
    setRefreshError(null);
  }
  return (
    <div className="import-refinement">
      <div className="panel import-card">
        {!draft ? (
          <>
            <div className="section-top">
              <h2>{t("title")}</h2>
              <span className="badge">{t("level")}</span>
            </div>
            <div className="segmented">
              <Button
                variant="secondary"
                disabled={pending}
                className="aria-pressed:bg-selected-surface aria-pressed:border-control-border"
                aria-pressed={kind === "character"}
                onClick={() => changeKind("character")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path d="M9 3h6v4a3 3 0 1 1 4 4h2v10h-7v-2a3 3 0 1 0-6 0v2H3v-7h2a3 3 0 1 0 0-6H3V3h6Z" />
                </svg>
                {t("addonExport")}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                className="aria-pressed:bg-selected-surface aria-pressed:border-control-border"
                aria-pressed={kind === "profile"}
                onClick={() => changeKind("profile")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M9 12l-2 3 2 3m5-6 2 3-2 3" />
                </svg>
                {t("simulatorProfile")}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                className="aria-pressed:bg-selected-surface aria-pressed:border-control-border"
                aria-pressed={kind === "warmane"}
                onClick={() => changeKind("warmane")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path d="M4 21V7h4V3h8v4h4v14M2 21h20M9 21v-6h6v6M8 7h8M8 11h1m6 0h1" />
                </svg>
                {t("warmaneArmory")}
              </Button>
            </div>
            <div className="import-input-section">
              {kind === "warmane" ? (
                <WarmaneFields
                  value={armory}
                  pending={pending}
                  invalid={!!errors.character}
                  onReview={review}
                  onChange={(value) => {
                    stopArmoryRequest();
                    setArmory(value);
                    setSavedProfile(null);
                    setArmoryMeta(null);
                    setRefreshError(null);
                    setErrors((current) => ({
                      ...current,
                      character: undefined,
                    }));
                  }}
                />
              ) : (
                <>
                  <div className="import-field-title">
                    <span className="import-step" aria-hidden="true">
                      1
                    </span>
                    <label htmlFor="character">
                      {kind === "character"
                        ? t("characterExport")
                        : t("simulatorProfile")}
                    </label>
                    <span className="small muted">{t("required")}</span>
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
                        ? t("characterPlaceholder")
                        : t("profilePlaceholder")
                    }
                  />
                  <ExportPreview text={character} kind={kind} />
                </>
              )}
              {errors.character && (
                <AlertMessage id="character-error" tone="error">
                  {localizeDiagnostic(errors.character, td)}
                </AlertMessage>
              )}
              {savedProfile && (
                <WarmaneSavedProfileOffer
                  retrievedAt={savedProfile}
                  pending={pending}
                  onUse={() => void review("saved")}
                />
              )}
            </div>
            <div className="import-input-section">
              <div className="import-field-title">
                <span className="import-step" aria-hidden="true">
                  2
                </span>
                <label htmlFor="bags">{t("bagExport")}</label>
                <span className="small muted">{t("optional")}</span>
              </div>
              <p id="bags-help" className="small muted">
                {t("bagsHelp")}
              </p>
              <textarea
                id="bags"
                disabled={pending}
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
                placeholder={t("bagsPlaceholder")}
              />
              <ExportPreview text={bags} kind="bags" />
              {errors.bags && (
                <AlertMessage id="bags-error" tone="error">
                  {localizeDiagnostic(errors.bags, td)}
                </AlertMessage>
              )}
            </div>
            <Button
              variant="primary"
              className="primary"
              onClick={kind === "warmane" ? undefined : () => void review()}
              type={kind === "warmane" ? "submit" : "button"}
              form={kind === "warmane" ? "warmane-import" : undefined}
              disabled={
                pending ||
                !(kind === "warmane" ? armory.name.trim() : character.trim())
              }
              aria-busy={pending}
            >
              <span role={pending ? "status" : undefined}>
                {t(pending ? "armoryFetching" : "reviewImport")}
              </span>{" "}
              <span aria-hidden="true">→</span>
            </Button>
          </>
        ) : (
          <>
            {kind === "warmane" && (
              <WarmaneImportStatus
                meta={armoryMeta}
                pending={pending}
                error={refreshError}
                onRefresh={() => void refreshArmory()}
              />
            )}
            <ImportReview
              draft={draft}
              bagDraft={bagDraft}
              resolved={resolved}
              preset={preset}
              errors={errors}
              onPreset={(id) => {
                presetRef.current = id;
                setPreset(id);
                setErrors({});
                resolve(draft, bagDraft, id);
              }}
              onBack={() => {
                stopArmoryRequest();
                setDraft(null);
                setResolved(null);
                setErrors({});
                setArmoryMeta(null);
                setSavedProfile(null);
                setRefreshError(null);
              }}
              onResolved={onResolved}
            />
          </>
        )}
      </div>
      <ImportInstructions armory={kind === "warmane"} />
    </div>
  );
}

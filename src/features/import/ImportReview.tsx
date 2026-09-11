"use client";
import type { ErrorDescriptor } from "@/i18n/error";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { validateItem } from "@/domain/equipment/validate";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
import { BagPreview } from "./BagPreview";
import { AlertMessage } from "@/components/ui/Alert";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import type { Snapshot } from "@/domain/top-gear/model";
import { Class, Profession } from "@/generated/wotlk/common";
import { ImportedItemsPreview } from "./ImportedItemsPreview";
import { listSpecs } from "@/features/settings/registry";
import type { ImportDraft } from "./parse-export";
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
  if (count === paths.length) return "sourceImported";
  if (count) return ready ? "sourceCombined" : "sourcePending";
  return ready ? "sourcePreset" : "sourceChoose";
}
export type Review = {
  snapshot: Snapshot;
  supported: number;
  unsupported: number;
};
export function ImportReview({
  draft,
  bagDraft,
  resolved,
  preset,
  errors,
  onPreset,
  onBack,
  onResolved,
}: {
  draft: ImportDraft;
  bagDraft: ImportDraft | null;
  resolved: Review | null;
  preset: string;
  errors: { preset?: ErrorDescriptor };
  onPreset: (id: string) => void;
  onBack: () => void;
  onResolved: (snapshot: Snapshot) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("import");
  const td = useTranslations("diagnostics");
  const className = draft
    ? Class[draft.classId ?? 0]
        .replace(/^Class/, "")
        .replace("Deathknight", "Death Knight")
    : "";
  const supportedBagItems = resolved
    ? resolved.snapshot.inventory.filter(
        (item) =>
          item.source === "bag" &&
          !validateItem(resolved.snapshot, item).some(
            (diagnostic) => diagnostic.severity === "error",
          ),
      )
    : [];
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
    <>
      <p className="eyebrow">{t("reviewTitle")}</p>
      <div className="import-identity">
        <ReviewIcon
          icon={`classicon_${className.toLowerCase().replaceAll(" ", "")}`}
          size={44}
        />
        <div>
          <h2>{String(importedPlayer?.name ?? t("yourCharacter"))}</h2>
          <p className="muted">{t("classLevel", { className })}</p>
        </div>
        <span className="badge">{t("characterImported")}</span>
      </div>
      <ImportedItemsPreview items={draft.inventory} />
      <div className="import-preset">
        <label htmlFor="preset">{t("presetLabel")}</label>
        <Select
          id="preset"
          value={preset}
          aria-invalid={!!errors.preset}
          aria-describedby="preset-help"
          onValueChange={(value) => {
            const id = value;
            onPreset(id);
          }}
        >
          <SelectOption value="">{t("chooseSpec")}</SelectOption>
          {listSpecs()
            .filter((spec) => spec.classId === draft.classId)
            .map((spec) => (
              <SelectOption key={spec.id} value={spec.id}>
                {spec.className} · {spec.name}
              </SelectOption>
            ))}
        </Select>
        <p id="preset-help" className="small muted">
          {t("presetHelp")}
        </p>
      </div>
      {errors.preset && (
        <AlertMessage tone="error">
          {localizeDiagnostic(errors.preset, td)}
        </AlertMessage>
      )}
      <div className="import-bag-review">
        <div className="import-bag-status" aria-label={t("bagCompatibility")}>
          <div>
            {t.rich("bagCount", {
              count: bagDraft?.inventory.length ?? 0,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
          {resolved ? (
            <p>
              <span className="accent">
                {t("supportedCount", { count: resolved.supported })}
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                {t("unsupportedCount", { count: resolved.unsupported })}
              </span>
            </p>
          ) : (
            <p className="small muted">{t("chooseCompatibility")}</p>
          )}
          {!!resolved?.unsupported && (
            <p className="small muted">{t("unsupportedHelp")}</p>
          )}
        </div>
        {resolved && supportedBagItems.length > 0 && (
          <ItemVersionContext value={itemVersionOf(resolved.snapshot)}>
            <BagPreview items={supportedBagItems} label={t("supportedBags")} />
          </ItemVersionContext>
        )}
      </div>
      <div className="import-review-heading">
        <h3>{t("settings")}</h3>
        <span className="small muted">{t("editableAfterImport")}</span>
      </div>
      <dl className="import-setting-sources">
        {[
          ["Talents", ["player.talentsString"]],
          ["Glyphs", ["player.glyphs"]],
          ["Buffs", ["raidBuffs", "partyBuffs", "debuffs", "player.buffs"]],
          ["Consumables", ["player.consumes"]],
          ["Encounter", ["encounter"]],
          ["Professions", ["player.profession1", "player.profession2"]],
        ].map(([label, paths]) => (
          <div key={label as string}>
            <dt>{t(`setting${label as string}`)}</dt>
            <dd>{t(sourceLabel(draft, paths as string[], !!resolved))}</dd>
          </div>
        ))}
      </dl>
      {professions.length > 0 && (
        <div className="import-professions">
          {professions.map((profession, index) => (
            <div key={`${profession}-${index}`}>
              <ReviewIcon
                icon={professionIcons[profession] ?? "inv_misc_questionmark"}
              />
              <span>
                {Profession[profession]}
                <small>
                  {draft.professionLevels?.[profession]
                    ? `${new Intl.NumberFormat(locale).format(draft.professionLevels[profession])} / 450`
                    : t("rankNotExported")}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <Button
          variant="secondary"
          onClick={() => {
            onBack();
          }}
        >
          {t("back")}
        </Button>
        <Button
          variant="primary"
          className="primary"
          disabled={!resolved}
          onClick={() => resolved && onResolved(resolved.snapshot)}
        >
          {t("selectGear")} <span aria-hidden="true">→</span>
        </Button>
      </div>
    </>
  );
}

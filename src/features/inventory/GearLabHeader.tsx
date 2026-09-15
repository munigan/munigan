"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Snapshot } from "@/domain/top-gear/model";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { defaultGemming, hasJewelcrafting } from "@/domain/equipment/gemming";
import { getSpec } from "@/features/settings/registry";
import { SettingIcon } from "@/features/settings/SettingIcon";
import { Button } from "@/components/ui/Button";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import metadata from "../../../data/wotlk/settings-ui.json";
import { CharacterPortrait } from "./CharacterPortrait";
import { ItemImage } from "./Item";
import { useGearLabSelector } from "./state/GearLabProvider";
import "./gear-lab-header.css";

function ArrowUpRight() {
  return (
    <svg
      className="setup-open-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

/** Only show enabled effects; custom or cleared configurations must not imply full raid buffs. */
export function activeRaidBuffs(snapshot: Snapshot) {
  const buffs: Record<string, unknown> = { ...snapshot.settings.raidBuffs };
  return Object.entries(metadata.buffs)
    .filter(([path]) => {
      if (!path.startsWith("raidBuffs.")) return false;
      const value = buffs[path.slice("raidBuffs.".length)];
      return (
        value === true ||
        (typeof value === "number" && value > 0) ||
        value === "TristateEffectRegular" ||
        value === "TristateEffectImproved"
      );
    })
    .flatMap(([path, effect]) =>
      "icon" in effect ? [{ path, ...effect }] : [],
    );
}

export const GearLabHeader = memo(function GearLabHeader({
  onImport,
  onSettings,
  onEnhancements,
}: {
  onImport(): void;
  onSettings(): void;
  onEnhancements(): void;
}) {
  const t = useTranslations("inventory");
  const snapshot = useGearLabSelector((state) => state.draft!.snapshot);
  const actions = useGearLabSelector((state) => state.actions);
  const spec = getSpec(snapshot.specId);
  const [infoOpen, setInfoOpen] = useState(false);
  const config = snapshot.gemming ?? defaultGemming(snapshot);
  const gemIds = config.enabled
    ? [
        config.defaultGemId,
        config.metaGemId,
        ...(hasJewelcrafting(snapshot) ? [config.jcGemId] : []),
      ]
    : [];
  const buffs = activeRaidBuffs(snapshot);
  const autoEnchant = snapshot.autoEnchant ?? true;
  const enhancementLabel =
    config.enabled && autoEnchant
      ? "automatic"
      : !config.enabled && !autoEnchant
        ? "imported"
        : config.enabled
          ? "autoGemsOnly"
          : "autoEnchantsOnly";
  return (
    <div className="gear-lab-header">
      <div className="gear-character-heading">
        <CharacterPortrait className={spec.className} snapshot={snapshot} />
        <div className="gear-character-name">
          <h1>{snapshot.settings.player!.name || t("run.character")}</h1>
          <p>
            {spec.name} ·{" "}
            {spec.className.replace("Deathknight", "Death Knight")} · 80
          </p>
        </div>
        <Button variant="ghost" onClick={onImport}>
          {t("run.edit")}
        </Button>
      </div>
      <div className="gear-setup-strip">
        <div className="gear-setup-version">
          <div className="gear-setup-title">
            <span>{t("run.itemVersion")}</span>
            <TooltipRoot open={infoOpen} onOpenChange={setInfoOpen}>
              <TooltipTrigger
                render={<button type="button" />}
                className="gear-version-info"
                aria-label={t("compact.versionInfo")}
                onClick={() => setInfoOpen((value) => !value)}
                closeOnClick={false}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6M12 7v.2" />
                </svg>
              </TooltipTrigger>
              <TooltipContent className="gear-version-tooltip" role="tooltip">
                <strong>{t("compact.versionInfo")}</strong>
                <p>{t("compact.versionHelp")}</p>
                <p>Original 3.3.5a: {t("versions.original.description")}</p>
                <p>Wrath Classic: {t("versions.classic.description")}</p>
              </TooltipContent>
            </TooltipRoot>
          </div>
          <div
            className="gear-version-segments"
            role="group"
            aria-label={t("run.itemVersion")}
          >
            {(["original", "classic"] as const).map((version) => (
              <button
                type="button"
                key={version}
                aria-pressed={itemVersionOf(snapshot) === version}
                onClick={() => actions.setItemVersion(version)}
              >
                {version === "original" ? "Original 3.3.5a" : "Wrath Classic"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="gear-setup-action"
          onClick={onSettings}
          aria-label={t("run.settings")}
        >
          <span className="gear-setup-content">
            <span className="gear-setup-title">{t("run.settings")}</span>
            <span className="gear-setup-preview">
              <span className="gear-setup-images">
                {buffs.slice(0, 3).map((buff) => (
                  <SettingIcon key={buff.path} icon={buff.icon} />
                ))}
              </span>
              <span>
                {t(buffs.length ? "compact.raidBuffs" : "compact.noRaidBuffs")}
              </span>
            </span>
          </span>
          <ArrowUpRight />
        </button>
        <button
          type="button"
          className="gear-setup-action"
          onClick={onEnhancements}
          aria-label={t("gems.title")}
        >
          <span className="gear-setup-content">
            <span className="gear-setup-title">{t("gems.title")}</span>
            <span className="gear-setup-preview">
              <span className="gear-setup-images">
                {gemIds.map((itemId, index) => (
                  <ItemImage
                    key={`${index}-${itemId}`}
                    itemId={itemId}
                    size={22}
                  />
                ))}
              </span>
              <span>{t(`compact.${enhancementLabel}`)}</span>
            </span>
          </span>
          <ArrowUpRight />
        </button>
      </div>
    </div>
  );
});

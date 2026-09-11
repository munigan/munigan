"use client";
import { useTranslations, useLocale } from "next-intl";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { gemDescription } from "./gem-labels";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDismiss,
} from "@/components/ui/Dialog";

import type { GemmingSettings, Snapshot } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  defaultGemming,
  hasJewelcrafting,
  supportedMetaGem,
} from "@/domain/equipment/gemming";
import { GemColor, Profession } from "@/generated/wotlk/common";
import { RunSettingRow, RunSettingAction } from "./RunSettingRow";
import { ItemIcon, ItemImage } from "./Item";

export function GemmingPanel({
  snapshot,
  onChange,
  onClose,
}: {
  snapshot: Snapshot;
  onChange: (snapshot: Snapshot) => void;
  onClose: () => void;
}) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const catalog = getCatalog(snapshot.itemVersion);
  const config = snapshot.gemming ?? defaultGemming(snapshot);
  const gems = [...catalog.gems.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  function update(patch: Partial<GemmingSettings>) {
    onChange({ ...snapshot, gemming: { ...config, ...patch } });
  }
  const fields = [
    {
      key: "defaultGemId" as const,
      label: t("gems.default"),
      options: gems.filter(
        (g) =>
          g.color !== GemColor.GemColorMeta &&
          !g.requiredProfession &&
          !g.unique,
      ),
    },
    {
      key: "metaGemId" as const,
      label: t("gems.meta"),
      options: gems.filter(
        (g) => g.color === GemColor.GemColorMeta && supportedMetaGem(g.id),
      ),
    },
    ...(hasJewelcrafting(snapshot)
      ? [
          {
            key: "jcGemId" as const,
            label: t("gems.jc"),
            options: gems.filter(
              (g) => g.requiredProfession === Profession.Jewelcrafting,
            ),
          },
        ]
      : []),
  ];
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="settings-dialog enhancement-dialog p-0!">
        <div className="enhancement-dialog-header section-top">
          <div>
            <p className="eyebrow">{t("gems.eyebrow")}</p>
            <DialogTitle id="enhancement-title">{t("gems.title")}</DialogTitle>
          </div>
          <DialogDismiss />
        </div>
        <div className="gemming-settings">
          <section className="enhancement-section">
            <h3>{t("gems.enchantTitle")}</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={snapshot.autoEnchant ?? true}
                onChange={(e) =>
                  onChange({ ...snapshot, autoEnchant: e.target.checked })
                }
              />
              {t("gems.copy")}
            </label>
            <p className="muted small">{t("gems.copyHelp")}</p>
          </section>
          <section className="enhancement-section">
            <h3>{t("gems.socketsTitle")}</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
              />
              {t("gems.fill")}
            </label>
            {config.enabled && (
              <div className="gemming-fields">
                {fields.map((field) => (
                  <div key={field.key} className="gemming-field">
                    {field.label}
                    <span>
                      <ItemIcon
                        item={{
                          instanceId: field.key,
                          itemId: config[field.key],
                          enchantId: 0,
                          gemIds: [],
                          source: "bag",
                        }}
                        size={44}
                      />
                      <SearchableSelect
                        label={field.label}
                        value={String(config[field.key])}
                        options={field.options.map((gem) => ({
                          value: String(gem.id),
                          label: gem.name,
                          description: gemDescription(gem, t, locale),
                          icon: <ItemImage itemId={gem.id} size={32} />,
                        }))}
                        emptyMessage={t("gems.empty")}
                        onValueChange={(value) =>
                          update({ [field.key]: Number(value) })
                        }
                      />
                    </span>
                  </div>
                ))}
                <p className="muted small">
                  {hasJewelcrafting(snapshot)
                    ? t("gems.socketHelpJc")
                    : t("gems.socketHelp")}
                </p>
              </div>
            )}
          </section>
          <p className="muted small enhancement-baseline">
            {t("gems.baseline")}
          </p>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

export function EnhancementSummary({
  snapshot,
  onOpen,
}: {
  snapshot: Snapshot;
  onOpen: () => void;
}) {
  const t = useTranslations("inventory");
  const config = snapshot.gemming ?? defaultGemming(snapshot);
  const gemIds = config.enabled
    ? [
        config.defaultGemId,
        config.metaGemId,
        ...(hasJewelcrafting(snapshot) ? [config.jcGemId] : []),
      ]
    : [];
  return (
    <RunSettingRow icon="enhancements" divider={false}>
      <RunSettingAction onClick={onOpen}>{t("gems.title")}</RunSettingAction>
      <p className="run-setting-description">
        {config.enabled
          ? t("enhancements.autoGems")
          : t("enhancements.importedGems")}{" "}
        ·{" "}
        {(snapshot.autoEnchant ?? true)
          ? t("enhancements.autoEnchants")
          : t("enhancements.importedEnchants")}
      </p>
      <div className="enhancement-preview">
        {gemIds.map((itemId, index) => (
          <ItemIcon
            key={index}
            size={24}
            item={{
              instanceId: `preview-${index}`,
              itemId,
              enchantId: 0,
              gemIds: [],
              source: "bag",
            }}
          />
        ))}
      </div>
    </RunSettingRow>
  );
}

import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/Tabs";
import { Select, SelectOption } from "@/components/ui/Select";
import { CharacterPortrait } from "@/features/inventory/CharacterPortrait";
import type { Snapshot } from "@/domain/top-gear/model";
import { getSpec } from "./registry";
import { SettingsIcon } from "./SettingsIcon";
const mobileQuery = "(max-width: 767px)";
function subscribe(cb: () => void) {
  const q = window.matchMedia(mobileQuery);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}
const isMobile = () => window.matchMedia(mobileQuery).matches,
  serverMobile = () => false;
export const useSettingsMobile = () =>
  useSyncExternalStore(subscribe, isMobile, serverMobile);
const categories = [
  "Encounter",
  "Talents & glyphs",
  "Rotation",
  "Buffs",
  "Consumes",
  "Professions",
  "Advanced",
] as const;
export const categoryKeys = {
  Encounter: "encounter",
  "Talents & glyphs": "talents",
  Rotation: "rotation",
  Buffs: "buffs",
  Consumes: "consumes",
  Professions: "professions",
  Advanced: "advanced",
} as const;
export type SettingsCategory = (typeof categories)[number];
export function SettingsNavigation({
  value,
  onChange,
  children,
  snapshot,
}: {
  value: SettingsCategory;
  onChange: (value: SettingsCategory) => void;
  children: ReactNode;
  snapshot: Snapshot;
}) {
  const t = useTranslations("settings"),
    mobile = useSettingsMobile(),
    spec = getSpec(snapshot.specId);
  if (mobile)
    return (
      <div className="settings-navigation settings-navigation-mobile">
        <div className="settings-mobile-picker">
          <Select
            aria-label={t("categoriesLabel")}
            value={value}
            onValueChange={(v) => onChange(v as SettingsCategory)}
          >
            {categories.map((c) => (
              <SelectOption key={c} value={c}>
                {t(`categories.${categoryKeys[c]}`)}
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="settings-body">{children}</div>
      </div>
    );
  return (
    <TabsRoot
      className="settings-navigation"
      orientation="vertical"
      value={value}
      onValueChange={(v) => onChange(v as SettingsCategory)}
    >
      <aside className="settings-sidebar">
        <div className="settings-character">
          <CharacterPortrait className={spec.className} snapshot={snapshot} />
          <div>
            <strong>{snapshot.settings.player?.name}</strong>
            <span>
              {spec.name} · {spec.className}
            </span>
          </div>
        </div>
        <p className="settings-nav-label">{t("simulationSettings")}</p>
        <TabsList
          className="settings-tabs gap-0"
          aria-label={t("categoriesLabel")}
        >
          {categories.map((c) => (
            <TabsTab
              key={c}
              value={c}
              className="rounded-none min-h-16 px-5 py-2.5 data-active:bg-[#191c21] data-active:text-action"
              aria-label={t(`categories.${categoryKeys[c]}`)}
            >
              <SettingsIcon name={categoryKeys[c]} />
              <span>
                <strong>{t(`categories.${categoryKeys[c]}`)}</strong>
                <small>{t(`navDescriptions.${categoryKeys[c]}`)}</small>
              </span>
              <i aria-hidden="true" />
            </TabsTab>
          ))}
        </TabsList>
        <div className="settings-nav-source">
          <span>{t("configurationSources")}</span>
          <div>
            <span className="badge">{t("source.imported")}</span>
            <span className="badge">{t("source.edited")}</span>
          </div>
        </div>
      </aside>
      <TabsPanel className="settings-body" value={value}>
        {children}
      </TabsPanel>
    </TabsRoot>
  );
}

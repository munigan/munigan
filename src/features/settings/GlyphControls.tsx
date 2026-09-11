"use client";
import { useTranslations } from "next-intl";
import type { JsonObject } from "@protobuf-ts/runtime";
import type { Snapshot } from "@/domain/top-gear/model";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SettingIcon } from "./SettingIcon";
import metadata from "../../../data/wotlk/settings-ui.json";
type Glyph = { kind: string; name: string; description: string; icon: string };
const glyphMeta = metadata.glyphs as Record<string, Record<string, Glyph>>;
export function GlyphControls({
  snapshot,
  onPatch,
}: {
  snapshot: Snapshot;
  onPatch: (p: JsonObject) => void;
}) {
  const t = useTranslations("settings");
  const glyphs = snapshot.settings.player?.glyphs,
    choices = glyphMeta[String(snapshot.settings.player?.class)] ?? {};
  return (
    <div className="visual-glyphs">
      {(["major", "minor"] as const).map((kind) => (
        <section key={kind}>
          <h4>
            {t(`glyphs.${kind}`)}{" "}
            <span className="badge">
              {
                [1, 2, 3].filter(
                  (n) => glyphs?.[`${kind}${n}` as keyof typeof glyphs],
                ).length
              }{" "}
              / 3
            </span>
          </h4>
          <div className="glyph-grid">
            {[1, 2, 3].map((n) => {
              const key = `${kind}${n}` as keyof NonNullable<typeof glyphs>,
                value = glyphs?.[key] ?? 0,
                item = choices[value];
              const options = [
                { value: "0", label: t("glyphs.empty") },
                ...(value && !item
                  ? [
                      {
                        value: String(value),
                        label: t("glyphs.imported", { id: value }),
                      },
                    ]
                  : []),
                ...Object.entries(choices)
                  .filter(([, g]) => g.kind === kind)
                  .sort((a, b) => a[1].name.localeCompare(b[1].name))
                  .map(([id, g]) => {
                    const disabled =
                      Number(id) !== value &&
                      Object.values(glyphs ?? {}).includes(Number(id));
                    return {
                      value: id,
                      label: g.name,
                      description: disabled
                        ? t("glyphs.duplicate")
                        : g.description,
                      icon: <SettingIcon icon={g.icon} />,
                      disabled,
                    };
                  }),
              ];
              return (
                <div className="glyph-control" key={key}>
                  <SearchableSelect
                    label={t(`glyphs.${kind}Slot`, { number: n })}
                    value={String(value)}
                    options={options}
                    triggerIcon={
                      <SettingIcon key={item?.icon ?? key} icon={item?.icon} />
                    }
                    onValueChange={(v) =>
                      onPatch({ player: { glyphs: { [key]: Number(v) } } })
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

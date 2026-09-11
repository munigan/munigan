"use client";

import { useId, type ComponentProps } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { classes } from "@/components/ui/classes";
import type { SpecChoice } from "./registry";
import { presetPresentation } from "./preset-presentation";
import "./preset-select.css";

type Props = Omit<ComponentProps<typeof Select>, "children"> & {
  options: SpecChoice[];
  placeholder: { value: string; label: string; disabled?: boolean };
};

export function DpsPresetSelect({
  options,
  placeholder,
  className,
  "aria-describedby": describedBy,
  ...props
}: Props) {
  const t = useTranslations("settings.presets");
  const pointsId = useId();
  const choices = options
    .map((spec) => ({ spec, ...presetPresentation(spec) }))
    .sort((a, b) => a.order - b.order);
  const trees = choices[0]?.treeNames.join(" / ");
  return (
    <>
      <Select
        {...props}
        className={classes("dps-preset-select", className)}
        aria-describedby={
          [describedBy, trees ? pointsId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        <SelectOption value={placeholder.value} disabled={placeholder.disabled}>
          {placeholder.label}
        </SelectOption>
        {choices.map(({ spec, key, icon, points }) => {
          const name = key ? t(`options.${key}.name`) : spec.name;
          const label = `${name} (${points})`;
          return (
            <SelectOption
              key={spec.id}
              value={spec.id}
              label={label}
              description={
                key ? t(`options.${key}.description`) : t("fallback")
              }
              icon={
                <Image
                  unoptimized
                  src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
                  alt=""
                  width={32}
                  height={32}
                />
              }
            >
              <span className="preset-select-label">
                <span>{name}</span>{" "}
                <span className="preset-select-points">({points})</span>
              </span>
            </SelectOption>
          );
        })}
      </Select>
      {trees && (
        <span className="preset-select-help" id={pointsId}>
          {t("pointsOrder", { trees })}
        </span>
      )}
    </>
  );
}

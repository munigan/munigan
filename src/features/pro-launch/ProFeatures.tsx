"use client";
import { useTranslations } from "next-intl";
import { ToolIcon } from "@/features/shell/ToolIcon";

export function ProFeatures() {
  const t = useTranslations("pro");
  const features = [
    { icon: "gear" as const, title: "gearTitle", body: "gearBody" },
    { icon: "logs" as const, title: "logTitle", body: "logBody" },
    { icon: "raid" as const, title: "raidTitle", body: "raidBody" },
  ];
  return (
    <ul className="pro-features">
      {features.map((feature) => (
        <li className="pro-feature" key={feature.title}>
          <span className="pro-feature-icon">
            <ToolIcon name={feature.icon} width="28" height="28" />
          </span>
          <span className="pro-feature-copy">
            <strong>{t(feature.title)}</strong>
            <span>{t(feature.body)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

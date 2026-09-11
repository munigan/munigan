"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import type { CombinationStat } from "./character-stats";
import { presentCombinationStat, reportPercentage } from "./stat-presentation";

export function CombinationStats({ stats }: { stats: CombinationStat[] }) {
  const tooltipId = useId();
  const t = useTranslations("reports");
  const locale = useLocale();
  return (
    <div className="combination-stats-cell" role="cell">
      {stats.length ? (
        <dl className="combination-stats" aria-label={t("keyStats")}>
          {stats.map((stat) => {
            const text = presentCombinationStat(stat, t, locale);
            return (
              <div key={stat.id} data-capped={stat.capped}>
                <dt>{text.label}</dt>
                <dd>
                  <TooltipRoot>
                    <TooltipTrigger
                      className="combination-stat-trigger"
                      aria-describedby={`${tooltipId}-${stat.id}`}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`${text.label}: ${reportPercentage(stat.percent, locale)}`}
                    >
                      {reportPercentage(stat.percent, locale)}
                    </TooltipTrigger>
                    <TooltipContent
                      role="tooltip"
                      id={`${tooltipId}-${stat.id}`}
                      className="combination-stat-tooltip"
                    >
                      <div className="combination-stat-tooltip-heading">
                        <strong>{text.label}</strong>
                        <span data-capped={stat.capped}>
                          {reportPercentage(stat.percent, locale)}
                        </span>
                      </div>
                      {text.lines.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </TooltipContent>
                  </TooltipRoot>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <span className="muted">{t("statsUnavailable")}</span>
      )}
    </div>
  );
}

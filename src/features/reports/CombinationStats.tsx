"use client";

import { Stat } from "@/generated/wotlk/common";
import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import type { CombinationStat } from "./character-stats";
import {
  capBreakdown,
  capLabel,
  capReferenceValue,
  compactCapContext,
  localizedCapDifference,
  talentBonusEntries,
  presentCombinationStat,
  reportPercentage,
} from "./stat-presentation";

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
            const cap =
              stat.presentation.kind === "cap"
                ? stat.presentation.cap
                : undefined;
            const bonuses = talentBonusEntries(
              cap?.talentBonuses ?? stat.talentBonuses,
              t,
              locale,
            );
            const breakdown = cap ? capBreakdown(cap, t, locale) : undefined;
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
                        <strong>{cap ? capLabel(cap, t) : text.label}</strong>
                        <span data-capped={stat.capped}>
                          {reportPercentage(stat.percent, locale)}
                        </span>
                      </div>
                      {cap ? (
                        <>
                          <p
                            className="stat-tooltip-status"
                            data-capped={cap.capped}
                          >
                            {localizedCapDifference(cap, t, locale)}
                          </p>
                          <p>
                            {cap.stat === Stat.StatExpertise
                              ? t("comparison.expertiseProgress", {
                                  current: cap.effective.toLocaleString(
                                    locale,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  ),
                                  cap: cap.cap.toLocaleString(locale),
                                })
                              : capReferenceValue(cap, t, locale)}{" "}
                            · {compactCapContext(cap, t, locale)}
                          </p>
                          {cap.stat === Stat.StatExpertise && (
                            <span className="sr-only">
                              {t("dodgeReduction")}
                            </span>
                          )}
                        </>
                      ) : (
                        <p>{text.lines[0]}</p>
                      )}
                      {(bonuses.length > 0 ||
                        cap?.presentation.bonuses.some(
                          (bonus) => bonus.kind === "racial",
                        )) && (
                        <div className="stat-tooltip-bonuses">
                          <h4>{t("comparison.included")}</h4>
                          {bonuses.map((bonus, index) => (
                            <div
                              className="stat-tooltip-bonus"
                              key={index}
                              aria-label={bonus.description}
                            >
                              <span>{bonus.name}</span>
                              <span>+{bonus.amount}</span>
                            </div>
                          ))}
                          {cap &&
                            breakdown?.included
                              .slice(bonuses.length)
                              .map((line) => <p key={line}>{line}</p>)}
                        </div>
                      )}
                      {breakdown &&
                        (breakdown.context.length > 0 ||
                          cap?.presentation.autoAttackCap !== undefined) && (
                          <div className="stat-tooltip-bonuses">
                            <h4>{t("comparison.context")}</h4>
                            {breakdown.context.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                            {cap?.presentation.autoAttackCap !== undefined && (
                              <p>
                                {t("comparison.autoAttackCap", {
                                  value: reportPercentage(
                                    cap.presentation.autoAttackCap,
                                    locale,
                                    0,
                                  ),
                                })}
                              </p>
                            )}
                          </div>
                        )}
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

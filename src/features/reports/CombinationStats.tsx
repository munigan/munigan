import { useLocale, useTranslations } from "next-intl";
import type { CombinationStat } from "./character-stats";
import { presentCombinationStat, reportPercentage } from "./stat-presentation";

export function CombinationStats({ stats }: { stats: CombinationStat[] }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  return (
    <div className="combination-stats-cell" role="cell">
      {stats.length ? (
        <dl className="combination-stats" aria-label={t("keyStats")}>
          {stats.map((stat) => {
            const text = presentCombinationStat(stat, t, locale);
            return (
              <div
                key={stat.id}
                title={text.description}
                data-capped={stat.capped}
              >
                <dt>{text.label}</dt>
                <dd>
                  {reportPercentage(stat.percent, locale)}
                  <span className="sr-only"> · {text.description}</span>
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

import { useLocale, useTranslations } from "next-intl";
import {
  capLabel,
  accuracyLedger,
  compactCapContext,
  capReferenceValue,
  localizedCapDifference,
  reportPercentage,
  talentBonusLines,
} from "./stat-presentation";
import {
  armorPenetrationPercent,
  characterStats,
  ratingConversions,
  type StatCap,
} from "./character-stats";
import { StatIcon } from "./StatIcon";
import type { TalentStatBonus } from "@/domain/equipment/talent-stat-bonuses";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDismiss,
} from "@/components/ui/Dialog";
import type { SetRow, Snapshot } from "@/domain/top-gear/model";
import { Stat } from "@/generated/wotlk/common";
import { getSpec } from "@/features/settings/registry";
import { number } from "./report-presentation";

function StatPercentage({ stat, rating }: { stat: Stat; rating: number }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const percent =
    stat === Stat.StatArmorPenetration
      ? armorPenetrationPercent(rating)
      : [Stat.StatMeleeCrit, Stat.StatSpellCrit].includes(stat)
        ? rating / ratingConversions.crit
        : [Stat.StatMeleeHaste, Stat.StatSpellHaste].includes(stat)
          ? rating / ratingConversions.haste
          : undefined;
  return percent === undefined ? null : (
    <small className="stat-percentage" title={t("percentageFromRating")}>
      {reportPercentage(percent, locale)}
    </small>
  );
}

function AccuracyStats({ stats }: { stats: StatCap[] }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const ledger = accuracyLedger(stats, t, locale);
  return (
    <section className="stats-accuracy" aria-label={t("accuracy")}>
      <div className="accuracy-columns" aria-hidden="true">
        {(["stat", "effective", "reference", "cap", "status"] as const).map(
          (key) => (
            <span key={key}>{t(`comparison.${key}`)}</span>
          ),
        )}
      </div>
      <dl className="accuracy-stats">
        {stats.map((item) => {
          const expertise = item.stat === Stat.StatExpertise;
          const percent = expertise ? item.effective / 4 : item.effective;
          return (
            <div
              className="accuracy-stat"
              data-capped={item.capped}
              key={item.id}
            >
              <dt>
                <StatIcon stat={item.stat} />
                {capLabel(item, t)}
              </dt>
              <dd className="accuracy-value">
                <strong>{reportPercentage(percent, locale)}</strong>
                <span className="sr-only">
                  {expertise ? t("dodgeReduction") : t("hit")}
                </span>
              </dd>
              <dd className="accuracy-rating">
                {t("ratingValue", { value: number(item.rating, locale) })}
                {expertise && (
                  <span>
                    {" "}
                    ·{" "}
                    {t("expertiseValue", {
                      value: item.effective.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </span>
                )}
              </dd>
              <dd className="accuracy-status">
                <span aria-hidden="true">{item.capped ? "✓" : "↓"}</span>
                {localizedCapDifference(item, t, locale)}
              </dd>
              <dd className="accuracy-reference">
                <span className="sr-only">{t("comparison.cap")}: </span>
                {capReferenceValue(item, t, locale)} ·{" "}
                {compactCapContext(item, t, locale)}
              </dd>
            </div>
          );
        })}
      </dl>
      {(ledger.included.length > 0 || ledger.context.length > 0) && (
        <div className="accuracy-ledger">
          {(["included", "context"] as const).map(
            (kind) =>
              ledger[kind].length > 0 && (
                <section key={kind}>
                  <h3>{t(`comparison.${kind}`)}</h3>
                  <ul>
                    {ledger[kind].map(([line, labels]) => (
                      <li key={line}>
                        <span>{line}</span>
                        <small>{labels.join(" · ")}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}
    </section>
  );
}

function PrimaryStats({
  stats,
  row,
  label,
  talentBonuses,
}: {
  stats: Stat[];
  row: SetRow;
  label: string;
  talentBonuses: TalentStatBonus[];
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  return (
    <table className="character-stats-table" aria-label={label}>
      <tbody>
        {stats.map((stat) => (
          <tr key={stat}>
            <th scope="row">
              <span className="stat-name">
                <StatIcon stat={stat} />
                {t(`stats.${Stat[stat]}`)}
              </span>
            </th>
            <td>
              {number(row.stats?.[stat] ?? 0, locale)}
              <StatPercentage stat={stat} rating={row.stats?.[stat] ?? 0} />
              {talentBonusLines(
                talentBonuses.filter((bonus) => bonus.stat === stat),
                t,
                locale,
              ).map((line) => (
                <small className="stat-talent-contribution" key={line}>
                  {line}
                </small>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatsDetails({
  row,
  snapshot,
  onClose,
}: {
  row: SetRow;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const t = useTranslations("reports");
  const { primary, accuracy, targetLevel, talentBonuses } = characterStats(
    row,
    snapshot,
  );
  const hasStats = row.stats?.some(
    (value) => Number.isFinite(value) && value !== 0,
  );
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="stats-dialog p-0! max-w-[1120px]!">
        <div className="stats-dialog-header">
          <div>
            <DialogTitle>{t("characterStats")}</DialogTitle>
            <p className="stats-character">
              {snapshot.settings.player?.name || t("character")} ·{" "}
              {getSpec(snapshot.specId).name}{" "}
              {getSpec(snapshot.specId).className} · {t("level", { level: 80 })}
            </p>
          </div>
          <DialogDismiss />
        </div>
        <div className="stats-dialog-body">
          {hasStats ? (
            <div className="stats-overview">
              <AccuracyStats stats={accuracy} />
              <section className="stats-primary">
                <h3>{t("primaryStats")}</h3>
                <PrimaryStats
                  stats={primary}
                  row={row}
                  label={t("primaryStats")}
                  talentBonuses={talentBonuses}
                />
              </section>
              <p className="stats-cap-note">
                {t("statsNote", { level: targetLevel })}
              </p>
            </div>
          ) : (
            <p className="stats-empty">{t("statsEmpty")}</p>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

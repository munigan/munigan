import type { createTranslator } from "next-intl";
import type messages from "../../../messages/en-US/reports.json";
import { Stat } from "@/generated/wotlk/common";
import type { CombinationStat, StatCap } from "./character-stats";
import type { TalentStatBonus } from "@/domain/equipment/talent-stat-bonuses";

type Translation = (
  key: Parameters<ReturnType<typeof createTranslator<typeof messages>>>[0],
  values?: Record<string, string | number>,
) => string;
const percentage = (value: number, locale: string, digits = 2) =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
const decimal = (value: number, locale: string, digits = 2) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export function localizedCapDifference(
  cap: StatCap,
  t: Translation,
  locale: string,
) {
  if (Math.abs(cap.difference) < 0.000001) return t("cap.at");
  const amount =
    cap.difference < 0
      ? Math.ceil(Math.abs(cap.difference) - 0.000001)
      : Math.floor(cap.difference + 0.000001);
  return t(cap.capped ? "cap.above" : "cap.below", {
    rating: amount ? decimal(amount, locale, 0) : "<1",
  });
}
export function capContext(cap: StatCap, t: Translation, locale: string) {
  return t(`context.${cap.presentation.context}`, {
    cap: percentage(cap.presentation.autoAttackCap ?? 0, locale, 0),
  });
}
export function capBonuses(cap: StatCap, t: Translation, locale: string) {
  return cap.presentation.bonuses.map(({ kind, amount }) =>
    t(`bonus.${kind}`, {
      amount: ["racial", "vengeance"].includes(kind)
        ? decimal(amount, locale, 0)
        : percentage(amount, locale, 0),
    }),
  );
}
export function talentBonusLines(
  bonuses: TalentStatBonus[] = [],
  t: Translation,
  locale: string,
) {
  return bonuses.map((bonus) => {
    const value = decimal(
      bonus.amount,
      locale,
      Number.isInteger(bonus.amount) ? 0 : 2,
    );
    const amount =
      bonus.unit === "expertise"
        ? t("expertiseValue", { value })
        : bonus.unit === "rating"
          ? t("ratingValue", { value })
          : percentage(
              bonus.amount,
              locale,
              Number.isInteger(bonus.amount) ? 0 : 2,
            );
    return t("talentContribution", { amount, talent: bonus.talent });
  });
}
export function capLabel(cap: StatCap, t: Translation, compact = false) {
  return t(`${compact ? "compact" : "labels"}.${cap.presentation.label}`);
}
function combinationStatText(
  stat: CombinationStat,
  t: Translation,
  locale: string,
) {
  const data = stat.presentation;
  if (data.kind === "cap") {
    const { cap } = data;
    return {
      label: capLabel(cap, t, true),
      lines: [
        cap.stat === Stat.StatExpertise
          ? t("cap.expertiseDescription", {
              value: decimal(cap.effective, locale),
            })
          : capLabel(cap, t),
        localizedCapDifference(cap, t, locale),
        capContext(cap, t, locale),
        ...capBonuses(cap, t, locale),
        ...talentBonusLines(cap.talentBonuses, t, locale),
      ],
    };
  }
  if (data.kind === "armorPenetration")
    return {
      label: t("labels.armorPenetration"),
      lines: [
        t("armorDescription"),
        ...talentBonusLines(stat.talentBonuses, t, locale),
      ],
    };
  const key =
    data.stat === Stat.StatSpellHaste
      ? "spellHaste"
      : data.stat === Stat.StatSpellCrit
        ? "spellCrit"
        : data.ranged
          ? "rangedCrit"
          : "meleeCrit";
  const label = t(`labels.${key}`);
  return {
    label,
    lines: [
      t(
        data.stat === Stat.StatSpellHaste
          ? "hasteDescription"
          : "ratingDescription",
        { stat: label },
      ),
      ...talentBonusLines(stat.talentBonuses, t, locale),
    ],
  };
}
export function presentCombinationStat(
  stat: CombinationStat,
  t: Translation,
  locale: string,
) {
  const text = combinationStatText(stat, t, locale);
  return { ...text, description: text.lines.join(" · ") };
}
export { percentage as reportPercentage };

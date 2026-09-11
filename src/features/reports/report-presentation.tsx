import { useLocale, useTranslations } from "next-intl";
import { reportPercentage } from "./stat-presentation";
export const number = (n: number, locale: string) =>
  n.toLocaleString(locale, { maximumFractionDigits: 1 });
const signed = (n: number | null, locale: string) =>
  n === null ? "—" : `${n > 0 ? "+" : ""}${number(n, locale)}`;
export function DpsChange({
  gain,
  percent,
  cell = false,
}: {
  gain: number | null;
  percent: number | null;
  cell?: boolean;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const direction =
    gain === null || gain === 0 ? "neutral" : gain > 0 ? "up" : "down";
  return (
    <span
      className={`dps-change dps-change--${direction}`}
      role={cell ? "cell" : undefined}
    >
      <span className="dps-change-value">
        <svg
          className="dps-change-icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            d={
              direction === "up"
                ? "M8 13V3m-4 4 4-4 4 4"
                : direction === "down"
                  ? "M8 3v10m-4-4 4 4 4-4"
                  : "M4 8h8"
            }
          />
        </svg>
        <span className="sr-only">
          {gain === null
            ? t("dpsUnavailable")
            : direction === "up"
              ? t("dpsUp")
              : direction === "down"
                ? t("dpsDown")
                : t("dpsNeutral")}
        </span>
        {signed(gain, locale)}
      </span>
      {percent !== null && (
        <small className="dps-change-percent">
          ({percent > 0 ? "+" : ""}
          {reportPercentage(percent, locale)})
        </small>
      )}
    </span>
  );
}

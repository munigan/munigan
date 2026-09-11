import type { AppLocale } from "./config";
export function formatNumber(value: number, locale: AppLocale, digits = 1) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(value);
}
export function formatPercentagePoints(
  value: number,
  locale: AppLocale,
  digits = 2,
) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

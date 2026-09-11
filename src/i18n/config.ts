export const locales = ["en-US", "pt-BR"] as const;
export type AppLocale = (typeof locales)[number];
export const localeCookie = "munigan.locale";
export const localeMaxAge = 60 * 60 * 24 * 365;
export function isLocale(value: unknown): value is AppLocale {
  return value === "en-US" || value === "pt-BR";
}
export const homepagePath = (locale: AppLocale) =>
  locale === "pt-BR" ? ("/pt-br" as const) : ("/en-us" as const);
export function localeFromSlug(slug: string): AppLocale | null {
  return slug === "en-us" ? "en-US" : slug === "pt-br" ? "pt-BR" : null;
}

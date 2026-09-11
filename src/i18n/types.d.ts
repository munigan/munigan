import type { AppLocale } from "./config";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
  }
}

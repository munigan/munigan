"use client";
import { useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { homepagePath, isLocale } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";
export function LanguageSelector() {
  const t = useTranslations("common");
  const { locale, switching, switchLocale, area } = useAppLocale();
  return (
    <div className="workbench-language">
      <p className="workbench-language-label">{t("language")}</p>
      <div className="workbench-language-control">
        <svg
          className="workbench-language-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
        </svg>
        <Select
          aria-label={t("language")}
          aria-busy={switching}
          value={locale}
          onValueChange={async (value) => {
            if (!isLocale(value)) return;
            if ((await switchLocale(value)) && area === "home")
              window.location.assign(homepagePath(value));
          }}
        >
          <SelectOption value="en-US">English</SelectOption>
          <SelectOption value="pt-BR">Português (Brasil)</SelectOption>
        </Select>
      </div>
    </div>
  );
}

"use client";
import { useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { homepagePath, isLocale } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";
export function LanguageFlag({ country }: { country: "US" | "BR" }) {
  return (
    <svg
      className="workbench-language-flag"
      width="22"
      height="16"
      viewBox="0 0 22 16"
      fill="none"
      aria-hidden="true"
    >
      {country === "US" ? (
        <>
          <path fill="#fff" d="M0 0h22v16H0z" />
          {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
            <path
              key={stripe}
              fill="#B43B45"
              d={`M0 ${(stripe * 16) / 13}h22v${16 / 13}H0z`}
            />
          ))}
          <path fill="#354A78" d="M0 0h10v8.62H0z" />
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={1 + col * 1.9}
                cy={1 + row * 1.6}
                r=".35"
                fill="#fff"
              />
            )),
          )}
        </>
      ) : (
        <>
          <path fill="#239653" d="M0 0h22v16H0z" />
          <path fill="#F7D54A" d="m11 1.8 9 6.2-9 6.2L2 8z" />
          <circle cx="11" cy="8" r="3.8" fill="#34568B" />
          <path d="M7.4 6.9c2.4-.4 5 .6 7.1 2" stroke="#fff" strokeWidth=".8" />
        </>
      )}
    </svg>
  );
}

export function LanguageSelector({ inline = false }: { inline?: boolean }) {
  const t = useTranslations("common");
  const { locale, switching, switchLocale, area } = useAppLocale();
  async function changeLanguage(value: string) {
    if (!isLocale(value)) return;
    if ((await switchLocale(value)) && area === "home")
      window.location.assign(homepagePath(value));
  }
  if (inline)
    return (
      <div
        className="drawer-language-options"
        role="group"
        aria-label={t("language")}
        aria-busy={switching}
      >
        {(["en-US", "pt-BR"] as const).map((value) => (
          <button
            key={value}
            disabled={switching}
            aria-pressed={locale === value}
            onClick={() => void changeLanguage(value)}
          >
            <LanguageFlag country={value === "en-US" ? "US" : "BR"} />
            <span>{value === "en-US" ? "English" : "Português (Brasil)"}</span>
            {locale === value && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  return (
    <div className="workbench-language">
      <p className="workbench-language-label">{t("language")}</p>
      <div className="workbench-language-control">
        <Select
          aria-label={t("language")}
          aria-busy={switching}
          value={locale}
          onValueChange={changeLanguage}
        >
          <SelectOption value="en-US">
            <span className="workbench-language-option">
              <LanguageFlag country="US" />
              English
            </span>
          </SelectOption>
          <SelectOption value="pt-BR">
            <span className="workbench-language-option">
              <LanguageFlag country="BR" />
              Português (Brasil)
            </span>
          </SelectOption>
        </Select>
      </div>
    </div>
  );
}

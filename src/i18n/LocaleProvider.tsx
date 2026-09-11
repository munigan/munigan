"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { localeCookie, localeMaxAge, type AppLocale } from "./config";
import { loadMessages, type Messages, type MessageArea } from "./messages";
function persist(locale: AppLocale) {
  try {
    document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=${localeMaxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    /* Preference still applies to the current session. */
  }
}
type LocaleState = {
  locale: AppLocale;
  switching: boolean;
  switchLocale: (locale: AppLocale) => Promise<boolean>;
  persistLocale: () => void;
  area: MessageArea;
};
const Context = createContext<LocaleState | null>(null);
export function useAppLocale() {
  const context = useContext(Context);
  if (!context) throw new Error("LocaleProvider is required");
  return context;
}
export function LocaleProvider({
  initialLocale,
  initialMessages,
  area,
  children,
}: {
  initialLocale: AppLocale;
  initialMessages: Messages;
  area: MessageArea;
  children: ReactNode;
}) {
  const [state, setState] = useState({
    locale: initialLocale,
    messages: initialMessages,
  });
  const [switching, setSwitching] = useState(false),
    [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  async function switchLocale(locale: AppLocale) {
    const request = ++sequence.current;
    setFailed(false);
    if (locale === state.locale) {
      persist(locale);
      setSwitching(false);
      return true;
    }
    setSwitching(true);
    try {
      const messages = await loadMessages(locale, area);
      if (request !== sequence.current) return false;
      persist(locale);
      setState({ locale, messages });
      return true;
    } catch {
      if (request === sequence.current) setFailed(true);
      return false;
    } finally {
      if (request === sequence.current) setSwitching(false);
    }
  }
  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);
  return (
    <Context
      value={{
        locale: state.locale,
        switching,
        switchLocale,
        persistLocale: () => persist(state.locale),
        area,
      }}
    >
      <NextIntlClientProvider
        locale={state.locale}
        messages={state.messages}
        timeZone="UTC"
      >
        {children}
        {failed && <LanguageFailure />}
      </NextIntlClientProvider>
    </Context>
  );
}
function LanguageFailure() {
  const t = useTranslations("common");
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-[110] max-w-sm rounded-panel border border-border bg-surface p-4 text-text"
    >
      {t("languageFailed")}
    </div>
  );
}

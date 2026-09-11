"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAccount } from "@/features/auth/AuthProvider";
import { AccountMenu } from "@/features/auth/AccountMenu";
import { useAppLocale } from "@/i18n/LocaleProvider";
import { homepagePath } from "@/i18n/config";
import { LanguageFlag, LanguageSelector } from "./LanguageSelector";
import { FutureTag, ToolIcon } from "./ToolIcon";
import { futureTools, type ToolIconName } from "./tools";
import { startTopGear } from "./top-gear-navigation";

type View = "navigation" | "language" | "account";

function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={back ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

export function DrawerNavigation({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("shell");
  const authT = useTranslations("auth");
  const common = useTranslations("common");
  const auth = useAccount();
  const { locale, area, persistLocale } = useAppLocale();
  const pathname = usePathname();
  const [view, setView] = useState<View>("navigation");
  const [moreOpen, setMoreOpen] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const languageRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const previousView = useRef<View>("navigation");
  useEffect(() => {
    if (view !== "navigation") backRef.current?.focus();
    else if (previousView.current === "language") languageRef.current?.focus();
    else if (previousView.current === "account") accountRef.current?.focus();
    previousView.current = view;
  }, [view]);
  const cards: {
    href: string;
    icon: ToolIconName;
    title: string;
    description: string;
    active: boolean;
    beta?: boolean;
  }[] = [
    {
      href: homepagePath(locale),
      icon: "overview",
      title: t("homeLabel"),
      description: t("drawer.homeHint"),
      active: ["/", "/en-us", "/pt-br"].includes(pathname),
    },
    {
      href: "/library",
      icon: "library",
      title: authT("library"),
      description: t("drawer.libraryHint"),
      active: pathname.startsWith("/library"),
    },
    {
      href: "/gear-lab",
      icon: "gear",
      title: t("gearLab"),
      description: t("drawer.gearHint"),
      active: pathname === "/gear-lab" || pathname.startsWith("/reports/"),
    },
    {
      href: "/raid-trainer",
      icon: "trainer",
      title: "Raid Trainer",
      description: t("drawer.trainerHint"),
      active: pathname.startsWith("/raid-trainer"),
      beta: true,
    },
  ];
  return (
    <div className="drawer-scroll-content">
      {view !== "navigation" ? (
        <section className="drawer-subview">
          <button
            ref={backRef}
            className="drawer-back"
            onClick={() => setView("navigation")}
          >
            <Chevron back />
            {t("drawer.back")}
          </button>
          <h2 className="drawer-heading">
            {view === "language" ? common("language") : authT("accountMenu")}
          </h2>
          {view === "language" ? (
            <LanguageSelector inline />
          ) : (
            <AccountMenu mobile showLibrary={false} onNavigate={onNavigate} />
          )}
        </section>
      ) : (
        <>
          <nav className="drawer-navigation" aria-label={t("tools")}>
            <h2 className="drawer-heading">{t("drawer.heading")}</h2>
            <div className="drawer-tool-grid">
              {cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="drawer-tool-card"
                  aria-current={card.active ? "page" : undefined}
                  onNavigate={
                    card.href === "/gear-lab"
                      ? (event) => {
                          if (!startTopGear()) event.preventDefault();
                        }
                      : undefined
                  }
                  onClick={() => {
                    if (area === "home") persistLocale();
                    onNavigate();
                  }}
                >
                  <span className="drawer-card-top">
                    <ToolIcon name={card.icon} />
                    {card.beta && (
                      <span className="workbench-beta-tag">{t("beta")}</span>
                    )}
                  </span>
                  <span className="drawer-card-copy">
                    <strong>{card.title}</strong>
                    <small>{card.description}</small>
                  </span>
                </Link>
              ))}
            </div>
            <button
              className="drawer-more"
              aria-expanded={moreOpen}
              aria-controls="drawer-future-tools"
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <ToolIcon name="more" />
              <span>{t("moreTools")}</span>
              <small>
                {t("drawer.futureCount", { count: futureTools.length })}
              </small>
              <span className="drawer-more-chevron" data-open={moreOpen}>
                <Chevron />
              </span>
            </button>
            {moreOpen && (
              <div id="drawer-future-tools" className="drawer-future-tools">
                {futureTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="drawer-future-row"
                    aria-disabled="true"
                  >
                    <ToolIcon name={tool.id} />
                    <span>{tool.name}</span>
                    <FutureTag />
                  </div>
                ))}
              </div>
            )}
          </nav>
          <div className="drawer-utilities">
            <button
              ref={languageRef}
              className="drawer-language"
              aria-label={common("language")}
              onClick={() => setView("language")}
            >
              <LanguageFlag country={locale === "pt-BR" ? "BR" : "US"} />
              <span>
                {locale === "pt-BR" ? "Português (Brasil)" : "English"}
              </span>
              <Chevron />
            </button>
            {auth.status === "authenticated" && auth.account ? (
              <button
                ref={accountRef}
                className="drawer-account"
                aria-label={authT("accountMenu")}
                onClick={() => setView("account")}
              >
                {auth.account.image ? (
                  <Image
                    className="auth-avatar"
                    src={auth.account.image}
                    width={36}
                    height={36}
                    alt=""
                    unoptimized
                  />
                ) : (
                  <span className="auth-avatar" aria-hidden="true">
                    {auth.account.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="drawer-account-copy">
                  <strong>{auth.account.name}</strong>
                  <small>{authT("discordAccount")}</small>
                </span>
                <Chevron />
              </button>
            ) : (
              <AccountMenu mobile onNavigate={onNavigate} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

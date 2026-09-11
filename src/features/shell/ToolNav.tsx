"use client";
import { useTranslations } from "next-intl";
import { homepagePath } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FutureTag, ToolIcon } from "./ToolIcon";
import { startTopGear } from "./top-gear-navigation";
import { futureTools } from "./tools";

export function ToolNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("shell");
  const { locale, area, persistLocale } = useAppLocale();
  return (
    <nav aria-label={t("tools")} className="workbench-nav">
      <div className="workbench-nav-items">
        <Link
          href={homepagePath(locale)}
          onClick={() => {
            if (area === "home") persistLocale();
            onNavigate?.();
          }}
          aria-current={
            ["/", "/en-us", "/pt-br"].includes(pathname) ? "page" : undefined
          }
          className="workbench-nav-row"
        >
          <ToolIcon name="overview" />
          <span>{t("overview")}</span>
        </Link>
        <p className="workbench-nav-label">{t("equipment")}</p>
        <Link
          href="/top-gear"
          onNavigate={(event) => {
            if (!startTopGear()) event.preventDefault();
          }}
          onClick={() => {
            if (area === "home") persistLocale();
            onNavigate?.();
          }}
          aria-current={pathname === "/top-gear" ? "page" : undefined}
          className="workbench-nav-row"
        >
          <ToolIcon name="gear" />
          <span>Top Gear</span>
        </Link>
        {futureTools
          .filter((tool) => tool.id === "raid" || tool.id === "balance")
          .map((tool) => (
            <div
              key={tool.id}
              className="workbench-nav-row workbench-nav-future"
              aria-disabled="true"
            >
              <ToolIcon name={tool.id} />
              <span>{tool.name}</span>
              <FutureTag />
            </div>
          ))}
        <p className="workbench-nav-label">{t("playstyle")}</p>
        {futureTools
          .filter((tool) => tool.id === "talents" || tool.id === "logs")
          .map((tool) => (
            <div
              key={tool.id}
              className="workbench-nav-row workbench-nav-future"
              aria-disabled="true"
            >
              <ToolIcon name={tool.id} />
              <span>{tool.name}</span>
              <FutureTag />
            </div>
          ))}
      </div>
    </nav>
  );
}

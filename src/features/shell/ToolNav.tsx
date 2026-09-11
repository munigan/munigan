"use client";
import { Menu } from "@base-ui/react/menu";
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
          <span>{t("gearLab")}</span>
        </Link>
        <Link
          href="/raid-trainer"
          onClick={() => {
            if (area === "home") persistLocale();
            onNavigate?.();
          }}
          aria-current={pathname === "/raid-trainer" ? "page" : undefined}
          className="workbench-nav-row"
        >
          <ToolIcon name="trainer" />
          <span>Raid Trainer</span>
        </Link>
        <Menu.Root>
          <Menu.Trigger className="workbench-nav-row workbench-more-trigger">
            <ToolIcon name="more" />
            <span>{t("moreTools")}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="m3 4.5 3 3 3-3" />
            </svg>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              sideOffset={8}
              align="start"
              className="workbench-more-positioner"
            >
              <Menu.Popup className="workbench-more-menu">
                {futureTools.map((tool) => (
                  <Menu.Item
                    key={tool.id}
                    disabled
                    className="workbench-nav-row workbench-nav-future"
                  >
                    <ToolIcon name={tool.id} />
                    <span>{tool.name}</span>
                    <FutureTag />
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </nav>
  );
}

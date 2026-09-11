"use client";
import { useTranslations } from "next-intl";
import { LanguageSelector } from "./LanguageSelector";
import { useState } from "react";
import Link from "next/link";
import { homepagePath } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";
import { ToolIcon } from "./ToolIcon";
import { Dialog } from "@base-ui/react/dialog";
import { DialogDismiss } from "@/components/ui/Dialog";
import { Brand } from "./Brand";
import { ToolNav } from "./ToolNav";
import { AccountMenu } from "@/features/auth/AccountMenu";

export function WorkbenchHeader() {
  const { locale, area, persistLocale } = useAppLocale();
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header workbench-header">
      <Brand />
      <div className="workbench-desktop-nav">
        <ToolNav />
      </div>
      <div className="workbench-header-utilities">
        <Link
          href={`${homepagePath(locale)}#how-it-works`}
          className="workbench-help"
          onClick={() => {
            if (area === "home") persistLocale();
          }}
        >
          <ToolIcon name="help" />
          <span>{t("help")}</span>
        </Link>
        <LanguageSelector />
        <AccountMenu />
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className="workbench-menu-button"
          aria-label={t("openNavigation")}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
          <Dialog.Popup className="workbench-drawer">
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="sr-only">{t("navigation")}</Dialog.Title>
              <Brand />
              <DialogDismiss />
            </div>
            <ToolNav onNavigate={() => setOpen(false)} />
            <Link
              href={`${homepagePath(locale)}#how-it-works`}
              className="workbench-help"
              onClick={() => setOpen(false)}
            >
              <ToolIcon name="help" />
              {t("help")}
            </Link>
            <LanguageSelector />
            <AccountMenu mobile onNavigate={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

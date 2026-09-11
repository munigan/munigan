"use client";
import { useTranslations } from "next-intl";
import { LanguageSelector } from "./LanguageSelector";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { DialogDismiss } from "@/components/ui/Dialog";
import { Brand } from "./Brand";
import { ToolNav } from "./ToolNav";

export function WorkbenchSidebar() {
  return (
    <aside className="workbench-sidebar">
      <Brand />
      <ToolNav />
      <LanguageSelector />
    </aside>
  );
}
export function WorkbenchHeader() {
  const pathname = usePathname();
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const title = ["/", "/en-us", "/pt-br"].includes(pathname)
    ? t("overview")
    : pathname === "/top-gear"
      ? "Top Gear"
      : pathname.startsWith("/reports/")
        ? t("report")
        : "munigan.app";
  return (
    <header className="site-header workbench-header">
      <div className="workbench-mobile-brand">
        <Brand />
      </div>
      <span className="workbench-page-label">{title}</span>
      <span className="workbench-status">
        <span aria-hidden="true" />
        {t("ready")}
      </span>
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
            <LanguageSelector />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

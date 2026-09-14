"use client";
import { useTranslations } from "next-intl";
import { LanguageSelector } from "./LanguageSelector";
import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { DialogDismiss } from "@/components/ui/Dialog";
import { Brand } from "./Brand";
import { ToolNav } from "./ToolNav";
import { DrawerNavigation } from "./DrawerNavigation";
import { AccountMenu } from "@/features/auth/AccountMenu";
import { ProLaunchButton } from "@/features/pro-launch/ProLaunchButton";

export function WorkbenchHeader() {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header workbench-header">
      <Brand />
      <div className="workbench-desktop-nav">
        <ToolNav />
      </div>
      <div className="workbench-header-utilities">
        <ProLaunchButton source="header" className="workbench-pro-button" />
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
          <Dialog.Backdrop className="workbench-drawer-backdrop" />
          <Dialog.Popup className="workbench-drawer">
            <div className="workbench-drawer-header">
              <Dialog.Title className="sr-only">{t("navigation")}</Dialog.Title>
              <Brand onNavigate={() => setOpen(false)} />
              <DialogDismiss />
            </div>
            <DrawerNavigation onNavigate={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

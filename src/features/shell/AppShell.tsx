"use client";
import { useTranslations } from "next-intl";
import { WorkbenchHeader } from "./WorkbenchNavigation";
import "./shell.css";
import { BackgroundProvider } from "./CharacterBackground";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  return (
    <div className="app-shell workbench-shell relative isolate min-h-dvh">
      <BackgroundProvider>
        <div className="workbench-content">
          <WorkbenchHeader />
          <main className="app-main relative z-1">{children}</main>
          <footer className="site-footer workbench-footer">
            <span className="font-brand font-semibold">munigan.app</span>
            <span>{t("footer")}</span>
          </footer>
        </div>
      </BackgroundProvider>
    </div>
  );
}

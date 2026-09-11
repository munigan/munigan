"use client";
import { useTranslations } from "next-intl";
import { WorkbenchHeader, WorkbenchSidebar } from "./WorkbenchNavigation";
import "./shell.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  return (
    <div className="app-shell workbench-shell relative isolate min-h-dvh">
      <WorkbenchSidebar />
      <div className="workbench-content">
        <WorkbenchHeader />
        <main className="app-main relative z-1">{children}</main>
        <footer className="site-footer workbench-footer">
          <span className="font-brand font-semibold">munigan.app</span>
          <span>{t("footer")}</span>
        </footer>
      </div>
    </div>
  );
}

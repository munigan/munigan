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
            <div className="workbench-footer-links">
              <span>{t("footer")}</span>
              <a
                href="https://github.com/munigan/munigan"
                className="workbench-github-link"
                aria-label="GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.974-.015-1.912-3.13.68-3.791-1.508-3.791-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.13.08 1.724 1.16 1.724 1.16 1.006 1.723 2.64 1.225 3.283.937.102-.728.393-1.225.715-1.507-2.498-.284-5.124-1.25-5.124-5.563 0-1.229.44-2.233 1.16-3.02-.117-.284-.503-1.429.11-2.978 0 0 .945-.302 3.094 1.154A10.79 10.79 0 0 1 12 6.184c.956.005 1.919.13 2.818.378 2.148-1.456 3.092-1.154 3.092-1.154.615 1.55.229 2.694.112 2.978.722.787 1.158 1.791 1.158 3.02 0 4.324-2.63 5.276-5.136 5.554.404.35.765 1.04.765 2.096 0 1.513-.014 2.733-.014 3.105 0 .3.203.65.774.54A11.252 11.252 0 0 0 12 .75Z" />
                </svg>
              </a>
            </div>
          </footer>
        </div>
      </BackgroundProvider>
    </div>
  );
}

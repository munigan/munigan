"use client";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

function ImportStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4 border-t border-border py-5">
      <span
        aria-hidden="true"
        className="w-7 shrink-0 font-brand text-base leading-6 text-action"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h3 className="font-body text-[17px] leading-6 font-semibold text-text">
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

export function ImportInstructions({ armory = false }: { armory?: boolean }) {
  const t = useTranslations("import");
  return (
    <aside className="import-instructions" aria-label={t("instructionsLabel")}>
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-4 tracking-[0.12em] text-action">
          {t("instructionsEyebrow")}
        </p>
        <h2 className="font-display text-[40px] leading-[44px] font-semibold">
          {t("instructionsTitle")}
        </h2>
        <p className="text-[15px] leading-6 text-muted">
          {t(armory ? "armoryInstructionsIntro" : "instructionsIntro")}
        </p>
      </div>
      <ol role="list" className="m-0 flex list-none flex-col p-0">
        {armory ? (
          <>
            <ImportStep number="01" title={t("armoryFindTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("armoryFindHelp")}
              </p>
            </ImportStep>
            <ImportStep number="02" title={t("armoryReviewTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("armoryReviewHelp")}
              </p>
            </ImportStep>
            <ImportStep number="03" title={t("armoryPresetTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("armoryPresetHelp")}
              </p>
            </ImportStep>
          </>
        ) : (
          <>
            <ImportStep number="01" title={t("installTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("installHelp")}
              </p>
              <a
                className="self-start text-sm leading-6 font-semibold text-action"
                href="https://github.com/Poli93/wowsimsexporter-wotlk-335/archive/refs/heads/main.zip"
                target="_blank"
                rel="noreferrer"
              >
                {t("getExporter")}
              </a>
            </ImportStep>
            <ImportStep number="02" title={t("openTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("openHelp")}
              </p>
              <code className="self-start rounded border border-border bg-surface px-2.5 py-[5px] font-brand text-base leading-5 text-action">
                /wse
              </code>
            </ImportStep>
            <ImportStep number="03" title={t("copyTitle")}>
              <p className="text-sm leading-[22px] text-muted">
                {t("copyHelp")}
              </p>
            </ImportStep>
          </>
        )}
      </ol>
    </aside>
  );
}

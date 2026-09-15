"use client";
import type { ReactNode } from "react";
import type { ProLaunchSource } from "@/domain/pro-launch/contracts";
import { useTranslations } from "next-intl";
import { useProLaunch } from "./ProLaunchProvider";

export function ProLaunchButton({
  source,
  children,
  onBeforeOpen,
  className,
}: {
  source: ProLaunchSource;
  children?: ReactNode;
  onBeforeOpen?(): void;
  className?: string;
}) {
  const t = useTranslations("pro");
  const pro = useProLaunch();
  return (
    <button
      className={className}
      onClick={(event) => {
        const target = event.currentTarget;
        onBeforeOpen?.();
        queueMicrotask(() => pro.open(source, target));
      }}
    >
      {source === "header" && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
        </svg>
      )}
      {children ?? t("goPro")}
    </button>
  );
}

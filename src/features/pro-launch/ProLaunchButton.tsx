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
      {children ?? t("goPro")}
    </button>
  );
}

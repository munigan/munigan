"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useAppLocale } from "@/i18n/LocaleProvider";
export function ToolLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const { persistLocale } = useAppLocale();
  return (
    <Link
      {...props}
      onClick={(e) => {
        persistLocale();
        onClick?.(e);
      }}
    />
  );
}

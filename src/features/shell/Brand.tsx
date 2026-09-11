"use client";
import { useTranslations } from "next-intl";
import { homepagePath } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";
import Link from "next/link";
import type { ComponentProps } from "react";

export function BrandSymbol(props: ComponentProps<"svg">) {
  return (
    <svg
      width="37"
      height="42"
      viewBox="0 0 37 42"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 8L18.5 1L34 8V28L18.5 41L3 28Z" fill="currentColor" />
      <path
        d="M10 27V14L18.5 22L27 14V27"
        stroke="#090A0C"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand() {
  const t = useTranslations("shell");
  const { locale } = useAppLocale();
  return (
    <Link
      href={homepagePath(locale)}
      aria-label={t("home")}
      className="inline-flex shrink-0 items-center gap-3 text-text no-underline hover:no-underline"
    >
      <BrandSymbol className="h-10 w-9 shrink-0 text-action" />
      <span className="font-brand text-[25px] leading-7 font-bold tracking-[-.045em]">
        munigan.app
      </span>
    </Link>
  );
}

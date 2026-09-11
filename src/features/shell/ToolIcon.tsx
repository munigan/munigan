"use client";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import type { ToolIconName } from "./tools";
const paths: Record<ToolIconName, string> = {
  library: "M4 4h5v17H4ZM12 4h4v17h-4Zm7 1 3 15",
  overview: "m3 10 9-7 9 7v11h-7v-7h-4v7H3Z",
  gear: "m8 3-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4-4 3Z",
  raid: "M3 21V9h5V4h8v5h5v12M6 9V6m12 3V6M10 21v-6h4v6M10 8h4",
  balance: "M12 3v18M4 7h16M7 7l-4 8h8L7 7Zm10 0-4 8h8l-4-8ZM8 21h8",
  talents: "M9 2h6v6H9ZM2 16h6v6H2Zm14 0h6v6h-6ZM12 8v4H5v4m7-4h7v4",
  logs: "M4 3v18h17M8 16v-5m5 5V7m5 9v-8",
  trainer:
    "M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  more: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4m0 3h.01",
};
export function ToolIcon({
  name,
  ...props
}: ComponentProps<"svg"> & { name: ToolIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function FutureTag() {
  const t = useTranslations("shell");
  return <span className="future-tag">{t("future")}</span>;
}

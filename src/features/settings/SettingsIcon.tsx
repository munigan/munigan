import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
  encounter: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </>
  ),
  talents: <path d="M8 3h8v5H8zM3 16h6v5H3zm12 0h6v5h-6zM12 8v4H6v4m6-4h6v4" />,
  rotation: (
    <path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6" />
  ),
  buffs: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12h8m-4-4v8" />,
  consumes: <path d="M9 3h6m-5 0v7L5 19q-1 2 2 2h10q3 0 2-2l-5-9V3M8 15h8" />,
  elixirs: (
    <path d="M3 3h6M4 3v5l-2 3v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8L8 8V3M2 14h8M15 5h6m-5 0v5l-2 3v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6l-2-3V5m-6 11h8" />
  ),
  professions: <path d="m14 3 7 7-4 4-3-3-9 10-3-3 10-9-3-3z" />,
  advanced: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20" />,
  raid: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3" />
    </>
  ),
  personal: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m4-14v6m-3-3h6" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m7 10 5 5 5-5" />,
};
export function SettingsIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.info}
    </svg>
  );
}

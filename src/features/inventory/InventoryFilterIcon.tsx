import type { ReactNode } from "react";

const icons = {
  "All slots": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  Armor: (
    <path d="m8 3-5 3-1 5 4 2 1-3v11h10V10l1 3 4-2-1-5-5-3a4 4 0 0 1-8 0Z" />
  ),
  Weapons: (
    <>
      <path d="m14 4 6-1-1 6-9 9-4-4 8-10ZM4 12l8 8M8 16l-5 5M2 20l2 2" />
      <path d="m11 13 5-5" />
    </>
  ),
  "Rings & trinkets": (
    <>
      <path d="m8 3-2 3 6 5 6-5-2-3H8ZM6 6h12M10 3l-1 3 3 5 3-5-1-3" />
      <path d="M6 10a8 8 0 1 0 12 0" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export function InventoryFilterIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      className="shrink-0 text-muted"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ToolNav() {
  const pathname = usePathname();
  return (
    <nav className="tool-nav" aria-label="Tools">
      <Link
        href="/top-gear"
        aria-current={pathname === "/top-gear" ? "page" : undefined}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M16 3a4 4 0 0 1-8 0L3 5l-2 5 5 2v9h12v-9l5-2-2-5-5-2Z" />
        </svg>
        Top Gear
      </Link>
    </nav>
  );
}

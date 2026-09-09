import Link from "next/link";
import { ToolNav } from "./ToolNav";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Link href="/" className="brand">
          <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
            <path
              d="M14 1L26 8V23L14 31L2 23V8L14 1ZM14 7V25M7 11L21 21M21 11L7 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>WOW DROPTIMIZER</span>
          <small>WRATH · 3.3.5a</small>
        </Link>
        <ToolNav />
      </header>
      <main>{children}</main>
    </>
  );
}

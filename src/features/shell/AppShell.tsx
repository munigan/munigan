import Link from "next/link";
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
        <a
          href="https://poli93.github.io/wotlk/"
          target="_blank"
          rel="noreferrer"
        >
          Simulator ↗
        </a>
      </header>
      <nav className="tool-nav" aria-label="Tools">
        <Link href="/top-gear" aria-current="page">
          Top Gear
        </Link>
        <span>Free to use · No account needed</span>
      </nav>
      <main>{children}</main>
      <footer>
        Powered by the{" "}
        <a href="https://github.com/Poli93/wotlk">Poli93 WotLK simulator</a>
        <span>Warmane · 3.3.5a</span>
      </footer>
    </>
  );
}

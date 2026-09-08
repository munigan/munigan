import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/barlow-condensed/600.css";
import "./globals.css";
import { AppShell } from "@/features/shell/AppShell";
import { WowheadTooltips } from "@/features/inventory/WowheadTooltips";
export const metadata: Metadata = {
  title: "Top Gear · WoW Droptimizer",
  description: "Compare your equipped and bag gear with the WotLK simulator.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
        <WowheadTooltips />
      </body>
    </html>
  );
}

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { loadMessages, type MessageArea } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/config";
import { DocumentControls } from "./DocumentControls";
import "@/app/globals.css";
import { AppShell } from "@/features/shell/AppShell";
import { WowheadTooltips } from "@/features/inventory/WowheadTooltips";
import { ToastProvider } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
export async function AppDocument({
  children,
  locale,
  area,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  area: MessageArea;
}) {
  const messages = await loadMessages(locale, area);
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider
          initialLocale={locale}
          initialMessages={messages}
          area={area}
        >
          <DocumentControls />
          <TooltipProvider delay={250}>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </TooltipProvider>
          <WowheadTooltips />
        </LocaleProvider>
      </body>
    </html>
  );
}

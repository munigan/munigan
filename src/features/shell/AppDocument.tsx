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
import { ToastProvider } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "@/features/auth/auth.css";
import { DeleteAccountDialogHost } from "@/features/auth/DeleteAccountDialog";
import { ProLaunchProvider } from "@/features/pro-launch/ProLaunchProvider";
import { Analytics } from "@/lib/analytics/Analytics";
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
              <AuthProvider>
                <Analytics />
                <ProLaunchProvider>
                  <AppShell>{children}</AppShell>
                  <DeleteAccountDialogHost />
                </ProLaunchProvider>
              </AuthProvider>
            </ToastProvider>
          </TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

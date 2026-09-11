import { cookies, headers } from "next/headers";
import { AppDocument } from "@/features/shell/AppDocument";
import { localeCookie } from "@/i18n/config";
import { resolveLocale } from "@/i18n/resolve-locale";
import { site } from "@/lib/site";
export const metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: "%s · munigan.app" },
};
export default async function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = resolveLocale(
    (await cookies()).get(localeCookie)?.value,
    (await headers()).get("accept-language"),
  );
  return (
    <AppDocument locale={locale} area="workbench">
      {children}
    </AppDocument>
  );
}

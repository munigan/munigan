import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { localeFromSlug } from "@/i18n/config";
import { AppDocument } from "@/features/shell/AppDocument";
export function generateStaticParams() {
  return [{ locale: "en-us" }, { locale: "pt-br" }];
}
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = localeFromSlug((await params).locale);
  if (!locale) notFound();
  setRequestLocale(locale);
  return (
    <AppDocument locale={locale} area="home">
      {children}
    </AppDocument>
  );
}

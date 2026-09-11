import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { localeFromSlug, homepagePath } from "@/i18n/config";
import { homepageMetadata } from "@/i18n/metadata";
import { HomePage } from "@/features/home/HomePage";
import { site } from "@/lib/site";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeFromSlug((await params).locale);
  if (!locale) notFound();
  return homepageMetadata(locale);
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeFromSlug((await params).locale);
  if (!locale) notFound();
  setRequestLocale(locale);
  const metadata = await homepageMetadata(locale);
  return (
    <HomePage
      structuredData={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: site.name,
        url: site.url + homepagePath(locale),
        description: metadata.description,
        inLanguage: locale,
        applicationCategory: "GameApplication",
        operatingSystem: "Web browser",
        publisher: { "@type": "Organization", name: "Munigan" },
      }}
    />
  );
}

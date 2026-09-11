import type { Metadata } from "next";
import { site } from "@/lib/site";
import { homepagePath, type AppLocale } from "./config";
import { loadMessages } from "./messages";
export async function homepageMetadata(locale: AppLocale): Promise<Metadata> {
  const home = (await loadMessages(locale, "home")).home as Record<
    string,
    string
  >;
  const url = site.url + homepagePath(locale),
    image =
      locale === "pt-BR"
        ? "/images/munigan-workbench-pt-br.png"
        : site.socialImage;
  return {
    metadataBase: new URL(site.url),
    title: { absolute: home.metaTitle },
    description: home.metaDescription,
    alternates: {
      canonical: url,
      languages: {
        "en-US": site.url + "/en-us",
        "pt-BR": site.url + "/pt-br",
        "x-default": site.url,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      title: home.socialTitle,
      description: home.metaDescription,
      locale: locale.replace("-", "_"),
      alternateLocale: [locale === "en-US" ? "pt_BR" : "en_US"],
      images: [{ url: image, width: 1200, height: 630, alt: home.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: home.metaTitle,
      description: home.metaDescription,
      images: [{ url: image, alt: home.imageAlt }],
    },
  };
}

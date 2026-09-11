import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = {
    "en-US": site.url + "/en-us",
    "pt-BR": site.url + "/pt-br",
    "x-default": site.url,
  };
  return ["en-us", "pt-br"].map((locale) => ({
    url: `${site.url}/${locale}`,
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages },
  }));
}

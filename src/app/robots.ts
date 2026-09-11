import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  // Reports remain crawlable so crawlers can read their noindex directive.
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}

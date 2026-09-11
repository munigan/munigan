import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wow-droptmizer.munigan.app" }],
        destination: "https://munigan.app/:path*",
        permanent: true,
      },
      {
        source: "/top-gear/:path*",
        destination: "/gear-lab/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/library",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/auth/return",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/reports/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};
export default createNextIntlPlugin()(config);

import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;

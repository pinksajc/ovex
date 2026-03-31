import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Puppeteer and Chromium from being bundled by webpack —
  // they must remain as native Node modules on the server.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;

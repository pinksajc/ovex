import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Puppeteer and Chromium from being bundled by webpack —
  // they must remain as native Node modules loaded at runtime.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],

  // Force Vercel's file tracer (NFT) to include the Chromium binary and
  // supporting assets that it would otherwise skip (they are not JS files
  // so NFT doesn't trace them automatically).
  outputFileTracingIncludes: {
    // Match the PDF generation API route
    "/api/propuestas/generate-pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;

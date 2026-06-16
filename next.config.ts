// Cache bust: 2026-06-16
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

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;

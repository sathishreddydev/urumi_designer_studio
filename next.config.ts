import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @react-pdf/renderer (and its internal React reconciler) from being
  // bundled into the SSR/server chunks. It must only ever run in the browser.
  // Without this, Next.js pulls it into the outfit-page server bundle and the
  // duplicate React instance causes a ReactCurrentOwner crash at startup.
  serverExternalPackages: ["@react-pdf/renderer"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Never cache HTML pages — browser always checks for a new version
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

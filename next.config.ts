import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All pages are client-side (Firebase Auth/Firestore runs in browser only)
  // This prevents SSR prerendering from trying to init Firebase with no env vars
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

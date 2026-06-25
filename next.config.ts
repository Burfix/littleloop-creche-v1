import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year (only effective when served over HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Disable browser features we don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Content Security Policy
  // firebase-admin is server-only; Firebase client SDK, Firestore, Storage, Auth
  // all connect to googleapis.com and firebaseio.com
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Firebase Auth, Firestore, Storage
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://firebasestorage.googleapis.com",
      // Scripts: Next.js chunks + no inline eval in production
      "script-src 'self' 'unsafe-inline'",
      // Styles: Tailwind inlines styles at runtime
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Firebase Storage + data URIs for avatars
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
      // Fonts: self only
      "font-src 'self'",
      // No object embeds
      "object-src 'none'",
      // Base URI locked to self
      "base-uri 'self'",
      // Block form submissions to external URLs
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],

  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

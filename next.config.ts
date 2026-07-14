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
      // Scripts: Next.js chunks + no inline eval in production. gstatic.com
      // is required by public/firebase-messaging-sw.js, which runs in its
      // own worker realm (inherits this CSP from its own response headers)
      // and importScripts()'s the Firebase compat SDK from there — without
      // this, the service worker fails to evaluate and push notifications
      // silently never register.
      "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
      // Styles: Tailwind inlines styles at runtime; fonts.googleapis.com
      // serves the landing page's Google Fonts stylesheet
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self + Firebase Storage + data URIs for avatars
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
      // Fonts: self + the actual font files Google Fonts serves (separate
      // host from the stylesheet above)
      "font-src 'self' https://fonts.gstatic.com",
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

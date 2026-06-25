import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SchoolProvider } from "@/lib/school-context";
import { ErrorBoundary } from "@/lib/error-boundary";
import { Toaster } from "react-hot-toast";
import { getSchoolBySlugServer } from "@/lib/server-school";
import { resolveTenantSlugFromHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LittleLoop",
  description: "Your child's day, in your pocket.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f8ef7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";
  const tenantSlug = headerStore.get("x-littleloop-tenant-slug") ?? resolveTenantSlugFromHost(host);
  const initialSchool = await getSchoolBySlugServer(tenantSlug);
  const bodyStyle = initialSchool?.primaryColor
    ? ({ "--brand": initialSchool.primaryColor } as CSSProperties)
    : undefined;

  return (
    <html lang="en">
      <body style={bodyStyle}>
        <ErrorBoundary>
          <AuthProvider>
            <SchoolProvider initialSlug={tenantSlug} initialSchool={initialSchool}>
              {children}
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    borderRadius: "10px",
                    fontSize: "14px",
                    maxWidth: "360px",
                  },
                }}
              />
            </SchoolProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

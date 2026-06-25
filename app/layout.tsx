import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SchoolProvider } from "@/lib/school-context";
import { ErrorBoundary } from "@/lib/error-boundary";
import { Toaster } from "react-hot-toast";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <SchoolProvider>
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

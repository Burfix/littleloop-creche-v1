import { NextRequest, NextResponse } from "next/server";
import { resolveTenantSlugFromHost } from "@/lib/tenant";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const tenantSlug = resolveTenantSlugFromHost(
    request.headers.get("host") ?? request.nextUrl.hostname
  );

  requestHeaders.set("x-littleloop-tenant-slug", tenantSlug);
  requestHeaders.set("x-littleloop-host", request.nextUrl.hostname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};

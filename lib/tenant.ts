const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_ROOT_DOMAIN = "littleloop.app";

function hostnameWithoutPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export function resolveTenantSlugFromHost(host: string): string {
  const hostname = hostnameWithoutPort(host);
  const defaultSlug = process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG ?? "demo";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN;

  if (!hostname || LOCAL_HOSTS.has(hostname)) {
    return defaultSlug;
  }

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return defaultSlug;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    const candidate = hostname.slice(0, -rootDomain.length - 1).split(".").at(-1);
    return candidate && candidate !== "www" ? candidate : defaultSlug;
  }

  const parts = hostname.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && !hostname.endsWith(".vercel.app")) {
    return parts[0];
  }

  return defaultSlug;
}

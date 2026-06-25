import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTenantSlugFromHost } from "@/lib/tenant";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

describe("resolveTenantSlugFromHost", () => {
  it("uses the default slug for localhost and the root domain", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG", "demo-school");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "littleloop.app");

    expect(resolveTenantSlugFromHost("localhost:3000")).toBe("demo-school");
    expect(resolveTenantSlugFromHost("littleloop.app")).toBe("demo-school");
    expect(resolveTenantSlugFromHost("www.littleloop.app")).toBe("demo-school");
  });

  it("extracts school slugs from wildcard school subdomains", () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "littleloop.app");

    expect(resolveTenantSlugFromHost("pebblestones.littleloop.app")).toBe("pebblestones");
    expect(resolveTenantSlugFromHost("branch.pebblestones.littleloop.app")).toBe("pebblestones");
  });

  it("does not treat Vercel preview hosts as tenants", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG", "demo");

    expect(resolveTenantSlugFromHost("littleloop-creche-v1-burfix.vercel.app")).toBe("demo");
  });
});

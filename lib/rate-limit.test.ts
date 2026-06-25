import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";

function requestFrom(ip: string) {
  return new NextRequest("https://littleloop.app/api/invite", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("enforceRateLimit", () => {
  it("allows requests under the limit and blocks the next request", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const config = {
      namespace: `test-${crypto.randomUUID()}`,
      limit: 2,
      windowSeconds: 60,
    };

    await expect(enforceRateLimit(requestFrom("203.0.113.10"), config)).resolves.toBeNull();
    await expect(enforceRateLimit(requestFrom("203.0.113.10"), config)).resolves.toBeNull();

    const blocked = await enforceRateLimit(requestFrom("203.0.113.10"), config);

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("keeps separate IP addresses isolated", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const config = {
      namespace: `test-${crypto.randomUUID()}`,
      limit: 1,
      windowSeconds: 60,
    };

    await expect(enforceRateLimit(requestFrom("203.0.113.20"), config)).resolves.toBeNull();
    await expect(enforceRateLimit(requestFrom("203.0.113.21"), config)).resolves.toBeNull();
  });
});

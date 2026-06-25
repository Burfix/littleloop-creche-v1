import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  namespace: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  backend: "upstash" | "memory";
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "Retry-After": String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Backend": result.backend,
  };
}

function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);
  const current = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + config.windowSeconds * 1000 };

  current.count += 1;
  memoryStore.set(key, current);

  for (const [storedKey, value] of memoryStore.entries()) {
    if (value.resetAt <= now) memoryStore.delete(storedKey);
  }

  return {
    allowed: current.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(config.limit - current.count, 0),
    resetAt: current.resetAt,
    backend: "memory",
  };
}

async function upstashRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, config.windowSeconds],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit failed with ${response.status}`);
  }

  const body = await response.json() as [{ result?: number }, { result?: number }];
  const count = Number(body[0]?.result ?? 0);
  const resetAt = (Math.floor(Date.now() / (config.windowSeconds * 1000)) + 1) * config.windowSeconds * 1000;

  return {
    allowed: count <= config.limit,
    limit: config.limit,
    remaining: Math.max(config.limit - count, 0),
    resetAt,
    backend: "upstash",
  };
}

export async function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const windowId = Math.floor(Date.now() / (config.windowSeconds * 1000));
  const key = `rate-limit:${config.namespace}:${ip}:${windowId}`;

  let result: RateLimitResult;
  try {
    result = await upstashRateLimit(key, config) ?? memoryRateLimit(key, config);
  } catch (err) {
    console.error("Rate limit backend unavailable:", err);
    return NextResponse.json(
      { error: "Rate limit check unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: rateLimitHeaders(result) }
  );
}

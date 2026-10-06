import type { NextRequest } from "next/server"

// Simple in-memory sliding-window rate limiter.
// NOTE: on serverless (Netlify Functions) every instance keeps its own map and
// it resets on cold start — treat this as a throttle, not a hard guarantee.

const buckets = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)

  // Occasionally evict dead buckets so client-controlled keys can't grow the map
  if (buckets.size > 10_000) {
    for (const [k, times] of buckets) {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k)
      if (buckets.size <= 5_000) break
    }
  }
  return true
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

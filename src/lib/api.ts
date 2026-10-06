import { NextResponse } from "next/server"

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

// Parse a `limit` query param into a safe integer in [1, max];
// invalid or out-of-range values fall back to `fallback`.
export function parseLimit(value: string | null, fallback: number, max = 100): number {
  const n = Number.parseInt(value || "", 10)
  if (!Number.isInteger(n) || n < 1) return fallback
  return Math.min(n, max)
}

import { SignJWT, jwtVerify } from "jose"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Session auth: JWT in an httpOnly cookie. Identity is derived server-side from
// the cookie — client-supplied user ids are never trusted.
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "wb_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  userId: string
  username: string
}

let cachedSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 32) {
    cachedSecret = new TextEncoder().encode(secret)
    return cachedSecret
  }
  // Graceful degradation for local/dev setups without AUTH_SECRET: use a
  // per-process random secret (sessions reset on restart) instead of crashing.
  // Production deployments MUST set AUTH_SECRET (see .env.example).
  console.warn(
    "[auth] AUTH_SECRET is not set (or shorter than 32 chars) — " +
      "using an ephemeral per-process secret. Sessions will not survive restarts."
  )
  cachedSecret = crypto.getRandomValues(new Uint8Array(48))
  return cachedSecret
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (typeof payload.userId !== "string" || typeof payload.username !== "string") {
      return null
    }
    return { userId: payload.userId, username: payload.username }
  } catch {
    return null
  }
}

export function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return Promise.resolve(null)
  return verifySessionToken(token)
}

export function setSessionCookie(res: import("next/server").NextResponse, payload: SessionPayload) {
  return createSessionToken(payload).then((token) => {
    res.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    })
  })
}

export function clearSessionCookie(res: import("next/server").NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

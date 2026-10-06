import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as LOGIN } from "@/app/api/auth/login/route"
import { POST as REGISTER } from "@/app/api/auth/register/route"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    ...actual,
    setSessionCookie: vi.fn().mockResolvedValue(undefined),
  }
})

import { prisma } from "@/lib/db"
import { setSessionCookie } from "@/lib/auth"

const mockPrisma = vi.mocked(prisma, true)

function makeRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "10.0.0.1",
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/auth/login", () => {
  it("returns a single unified error for unknown user (no enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const res = await LOGIN(makeRequest("http://localhost:3000/api/auth/login", {
      username: "ghost",
      password: "whatever",
    }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("用户名或密码错误")
  })

  it("returns the same unified error for a wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      username: "alice",
      password: "$2a$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidha",
      avatar: null,
      createdAt: new Date(),
    })
    const res = await LOGIN(makeRequest("http://localhost:3000/api/auth/login", {
      username: "alice",
      password: "wrong-password",
    }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("用户名或密码错误")
  })

  it("rejects malformed payloads with 400", async () => {
    const res = await LOGIN(makeRequest("http://localhost:3000/api/auth/login", { username: "" }))
    expect(res.status).toBe(400)
  })
})

describe("POST /api/auth/register", () => {
  it("creates a user and sets a session", async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: "u-2",
      username: "bob",
      password: "hashed",
      avatar: null,
      createdAt: new Date(),
    })

    const res = await REGISTER(makeRequest("http://localhost:3000/api/auth/register", {
      username: "  bob  ",
      password: "secret123",
    }))

    expect(res.status).toBe(200)
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: { username: "bob", password: expect.any(String) },
    })
    expect(setSessionCookie).toHaveBeenCalled()
  })

  it("rejects usernames with illegal characters", async () => {
    const res = await REGISTER(makeRequest("http://localhost:3000/api/auth/register", {
      username: "bad name!",
      password: "secret123",
    }))
    expect(res.status).toBe(400)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it("rejects short passwords", async () => {
    const res = await REGISTER(makeRequest("http://localhost:3000/api/auth/register", {
      username: "bob",
      password: "12345",
    }))
    expect(res.status).toBe(400)
  })

  it("rejects passwords beyond the 72-byte bcrypt limit", async () => {
    const res = await REGISTER(makeRequest("http://localhost:3000/api/auth/register", {
      username: "bob",
      password: "a".repeat(73),
    }))
    expect(res.status).toBe(400)
  })

  it("maps concurrent username conflicts to 409", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    mockPrisma.user.create.mockRejectedValue(p2002)

    const res = await REGISTER(makeRequest("http://localhost:3000/api/auth/register", {
      username: "taken",
      password: "secret123",
    }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("用户名已存在")
  })
})

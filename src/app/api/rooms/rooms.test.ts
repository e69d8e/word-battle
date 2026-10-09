import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as createRoom } from "@/app/api/rooms/route"
import { POST as joinRoom } from "@/app/api/rooms/join/route"
import { POST as leaveRoom } from "@/app/api/rooms/leave/route"

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  getSessionFromRequest: vi.fn(),
}))

import { prisma } from "@/lib/db"
import { getSessionFromRequest } from "@/lib/auth"

const mockPrisma = vi.mocked(prisma, true)
const mockSession = vi.mocked(getSessionFromRequest)

const USER_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ID = "22222222-2222-4222-8222-222222222222"

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function roomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-1",
    code: "AB23CD",
    status: "waiting",
    level: "CET4",
    hostId: USER_ID,
    guestId: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.mockResolvedValue({ userId: USER_ID, username: "tester" })
  mockPrisma.room.deleteMany.mockResolvedValue({ count: 0 } as never)
  mockPrisma.room.updateMany.mockResolvedValue({ count: 1 } as never)
  mockPrisma.room.create.mockImplementation((async (args: { data: Record<string, unknown> }) =>
    roomRow(args.data)) as never)
  mockPrisma.room.findUnique.mockResolvedValue(roomRow({ hostId: OTHER_ID }) as never)
})

describe("POST /api/rooms", () => {
  it("requires a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await createRoom(makeRequest({ level: "CET4" }))
    expect(res.status).toBe(401)
    expect(mockPrisma.room.create).not.toHaveBeenCalled()
  })

  it("creates a room with a server-generated code", async () => {
    const res = await createRoom(makeRequest({ level: "IELTS" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.room.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(body.room.level).toBe("IELTS")
    expect(body.room.filled).toBe(false)

    const created = mockPrisma.room.create.mock.calls[0][0].data as { hostId: string; level: string; expiresAt: Date }
    expect(created.hostId).toBe(USER_ID)
    expect(created.level).toBe("IELTS")
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("falls back to CET4 for an unsupported level", async () => {
    await createRoom(makeRequest({ level: "HACK" }))
    const created = mockPrisma.room.create.mock.calls[0][0].data as { level: string }
    expect(created.level).toBe("CET4")
  })

  it("recycles expired rooms and the host's previous room", async () => {
    await createRoom(makeRequest({}))
    const calls = mockPrisma.room.deleteMany.mock.calls
    expect(calls.some((c) => "expiresAt" in (c[0] as { where: object }).where)).toBe(true)
    expect(calls.some((c) => (c[0] as { where: { hostId?: string } }).where.hostId === USER_ID)).toBe(true)
  })

  it("retries when the generated code collides", async () => {
    const collision = Object.assign(new Error("unique"), { code: "P2002" })
    mockPrisma.room.create
      .mockRejectedValueOnce(collision as never)
      .mockImplementationOnce((async (args: { data: Record<string, unknown> }) => roomRow(args.data)) as never)

    const res = await createRoom(makeRequest({}))
    expect(res.status).toBe(200)
    expect(mockPrisma.room.create).toHaveBeenCalledTimes(2)
  })

  it("gives up after repeated collisions", async () => {
    const collision = Object.assign(new Error("unique"), { code: "P2002" })
    mockPrisma.room.create.mockRejectedValue(collision as never)
    const res = await createRoom(makeRequest({}))
    expect(res.status).toBe(503)
  })

  it("does not swallow unexpected database errors", async () => {
    mockPrisma.room.create.mockRejectedValue(new Error("db down") as never)
    const res = await createRoom(makeRequest({}))
    expect(res.status).toBe(500)
  })
})

describe("POST /api/rooms/join", () => {
  it("requires a session", async () => {
    mockSession.mockResolvedValue(null)
    expect((await joinRoom(makeRequest({ code: "AB23CD" }))).status).toBe(401)
  })

  it("rejects malformed codes", async () => {
    expect((await joinRoom(makeRequest({ code: "nope" }))).status).toBe(400)
    expect((await joinRoom(makeRequest({ code: "ABC0EF" }))).status).toBe(400)
    expect(mockPrisma.room.findUnique).not.toHaveBeenCalled()
  })

  it("rejects an unknown room", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null)
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(404)
  })

  it("rejects an expired room and cleans it up", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      roomRow({ hostId: OTHER_ID, expiresAt: new Date(Date.now() - 1000) }) as never
    )
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(404)
    expect(mockPrisma.room.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.room.updateMany).not.toHaveBeenCalled()
  })

  it("rejects joining your own room", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(roomRow({ hostId: USER_ID }) as never)
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(409)
  })

  it("rejects a room that already has a guest", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(roomRow({ hostId: OTHER_ID, guestId: "someone" }) as never)
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("房间已满") })
  })

  it("claims the free seat atomically", async () => {
    const res = await joinRoom(makeRequest({ code: "ab23cd" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.room.filled).toBe(true)
    expect(body.room.code).toBe("AB23CD")

    const claim = mockPrisma.room.updateMany.mock.calls[0][0]
    expect(claim.data.guestId).toBe(USER_ID)
    // Conditional update: the seat must still be free at write time
    expect(claim.where).toMatchObject({ id: "room-1" })
    expect((claim.where as { OR: unknown[] }).OR).toHaveLength(2)
  })

  it("loses the race for the last seat without claiming it twice", async () => {
    mockPrisma.room.updateMany.mockResolvedValue({ count: 0 } as never)
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(409)
  })

  it("lets the same guest rejoin (retry after a failed handshake)", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      roomRow({ hostId: OTHER_ID, guestId: USER_ID }) as never
    )
    const res = await joinRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(200)
  })
})

describe("POST /api/rooms/leave", () => {
  it("requires a session", async () => {
    mockSession.mockResolvedValue(null)
    expect((await leaveRoom(makeRequest({ code: "AB23CD" }))).status).toBe(401)
  })

  it("is a no-op for an unknown room", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null)
    const res = await leaveRoom(makeRequest({ code: "AB23CD" }))
    expect(res.status).toBe(200)
    expect(mockPrisma.room.deleteMany).not.toHaveBeenCalled()
  })

  it("closes the room when the host leaves", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(roomRow({ hostId: USER_ID, guestId: OTHER_ID }) as never)
    const res = await leaveRoom(makeRequest({ code: "AB23CD" }))
    expect((await res.json()).closed).toBe(true)
    expect(mockPrisma.room.deleteMany).toHaveBeenCalledWith({
      where: { id: "room-1", hostId: USER_ID },
    })
  })

  it("frees the seat when the guest leaves", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      roomRow({ hostId: OTHER_ID, guestId: USER_ID }) as never
    )
    const res = await leaveRoom(makeRequest({ code: "AB23CD" }))
    expect((await res.json()).closed).toBe(false)
    expect(mockPrisma.room.updateMany).toHaveBeenCalledWith({
      where: { id: "room-1", guestId: USER_ID },
      data: { guestId: null },
    })
    expect(mockPrisma.room.deleteMany).not.toHaveBeenCalled()
  })

  it("does not let a stranger free someone else's seat", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(roomRow({ hostId: OTHER_ID, guestId: "someone" }) as never)
    await leaveRoom(makeRequest({ code: "AB23CD" }))
    // The update is scoped to the session user, so it matches nothing
    expect(mockPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "room-1", guestId: USER_ID } })
    )
  })
})

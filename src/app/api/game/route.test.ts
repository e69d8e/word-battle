import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST, GET } from "./route"

vi.mock("@/lib/db", () => ({
  prisma: {
    game: { create: vi.fn(), findUnique: vi.fn() },
    score: { createMany: vi.fn() },
    $transaction: vi.fn(),
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
const OPPONENT_ID = "22222222-2222-4222-8222-222222222222"

function makeRequest(body: unknown, url = "http://localhost:3000/api/game") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "ai",
    wordLevel: "CET4",
    score1: 1500,
    score2: 800,
    status: "finished",
    questions: Array.from({ length: 10 }, () => ({
      type: "en2cn",
      options: ["a", "b", "c", "d"],
      answer1: "a",
      correct1: true,
      time1: 5000,
    })),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.mockResolvedValue({ userId: USER_ID, username: "tester" })
  mockPrisma.$transaction.mockImplementation(async (fn) =>
    fn(mockPrisma as unknown as Parameters<typeof fn>[0])
  )
  mockPrisma.game.findUnique.mockResolvedValue(null)
  mockPrisma.game.create.mockResolvedValue({ id: "game-1" } as never)
  mockPrisma.score.createMany.mockResolvedValue({ count: 2 })
})

describe("POST /api/game — auth", () => {
  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(401)
    expect(mockPrisma.game.create).not.toHaveBeenCalled()
  })

  it("ignores client-supplied player1Id and uses the session user", async () => {
    await POST(makeRequest(validBody({ player1Id: OPPONENT_ID })))
    expect(mockPrisma.game.create).toHaveBeenCalledTimes(1)
    const data = mockPrisma.game.create.mock.calls[0]![0].data
    expect(data.player1Id).toBe(USER_ID)
  })
})

describe("POST /api/game — validation", () => {
  it.each([
    { name: "missing mode", patch: { mode: undefined } },
    { name: "invalid mode", patch: { mode: "hack" } },
    { name: "invalid level", patch: { wordLevel: "GMAT" } },
    { name: "missing score1", patch: { score1: undefined } },
    { name: "negative score", patch: { score1: -5 } },
    { name: "non-integer score", patch: { score1: 1.5 } },
  ])("rejects invalid body: $name", async ({ patch }) => {
    const res = await POST(makeRequest(validBody(patch)))
    expect(res.status).toBe(400)
    expect(mockPrisma.game.create).not.toHaveBeenCalled()
  })

  it("rejects scores above the per-question cap (questions × 200)", async () => {
    const res = await POST(makeRequest(validBody({ score1: 2001 })))
    expect(res.status).toBe(400)
  })

  it("accepts a score at exactly questions × 200", async () => {
    const res = await POST(makeRequest(validBody({ score1: 2000 })))
    expect(res.status).toBe(200)
  })

  it("rounds fractional client timer values before persisting", async () => {
    // AI answers use Math.random()-derived times which are fractional floats
    const body = validBody()
    body.questions = Array.from({ length: 10 }, () => ({
      type: "en2cn",
      options: ["a", "b", "c", "d"],
      answer1: "a",
      correct1: true,
      time1: 5432.87,
      time2: 2100.5,
    }))
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(200)
    const created = mockPrisma.game.create.mock.calls[0]![0].data.questions! as unknown as {
      create: Array<{ time1: number; time2: number }>
    }
    expect(created.create[0].time1).toBe(5433)
    expect(created.create[0].time2).toBe(2101)
  })

  it("rejects more than 10 questions", async () => {
    const body = validBody()
    body.questions = Array.from({ length: 11 }, () => ({
      type: "en2cn",
      options: ["a", "b", "c", "d"],
    }))
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(400)
  })

  it("rejects unknown player2Id formats", async () => {
    const res = await POST(makeRequest(validBody({ player2Id: "not-a-uuid" })))
    expect(res.status).toBe(400)
  })
})

describe("POST /api/game — winner & persistence", () => {
  it("computes winner server-side (player2 wins when score2 > score1)", async () => {
    await POST(makeRequest(validBody({ score1: 100, score2: 500, player2Id: OPPONENT_ID })))
    const data = mockPrisma.game.create.mock.calls[0]![0].data
    expect(data.winnerId).toBe(OPPONENT_ID)
    expect(data.player2Id).toBe(OPPONENT_ID)
  })

  it("stores null winner on a draw", async () => {
    await POST(makeRequest(validBody({ score1: 300, score2: 300, player2Id: OPPONENT_ID })))
    expect(mockPrisma.game.create.mock.calls[0]![0].data.winnerId).toBeNull()
  })

  it("writes leaderboard scores for both players when finished", async () => {    await POST(makeRequest(validBody({ player2Id: OPPONENT_ID })))
    expect(mockPrisma.score.createMany).toHaveBeenCalledTimes(1)
    const rows = mockPrisma.score.createMany.mock.calls[0]![0]!.data
    expect(rows).toHaveLength(2)
  })

  it("does not write leaderboard scores for unfinished games", async () => {
    await POST(makeRequest(validBody({ status: "playing" })))
    expect(mockPrisma.score.createMany).not.toHaveBeenCalled()
  })

  it("gives the save transaction an explicit timeout (remote DB round trips)", async () => {
    await POST(makeRequest(validBody()))
    // Supabase round trips made a save take 4.6-9s, which intermittently exceeded
    // Prisma's 5s default and failed the save with P2028.
    const options = mockPrisma.$transaction.mock.calls[0]![1] as { timeout?: number; maxWait?: number } | undefined
    expect(options?.timeout).toBeGreaterThanOrEqual(10_000)
    expect(options?.maxWait).toBeGreaterThan(0)
  })

  it("ignores a wordId sent by an older client (the column no longer exists)", async () => {
    await POST(
      makeRequest(
        validBody({
          questions: [
            { wordId: "cet4-0", type: "en2cn", options: ["a", "b", "c", "d"], answer1: "a", correct1: true, time1: 1000 },
          ],
          // 1 question => the API caps both scores at 200
          score1: 150,
          score2: 100,
        })
      )
    )
    const questions = mockPrisma.game.create.mock.calls[0]![0].data.questions as {
      create: Array<Record<string, unknown>>
    }
    expect(questions.create).toHaveLength(1)
    // Unknown keys are stripped, so a cached client sending wordId still saves fine
    expect(questions.create[0]).not.toHaveProperty("wordId")
    expect(questions.create[0].type).toBe("en2cn")
  })
})

describe("POST /api/game — idempotency", () => {
  it("returns the existing game when clientId was already saved", async () => {
    const existing = {
      id: "game-existing",
      clientId: "33333333-3333-4333-8333-333333333333",
      player1Id: USER_ID,
    }
    mockPrisma.game.findUnique.mockResolvedValue(existing as never)

    const res = await POST(
      makeRequest(validBody({ clientId: "33333333-3333-4333-8333-333333333333" }))
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.game.id).toBe("game-existing")
    expect(body.duplicate).toBe(true)
    expect(mockPrisma.game.create).not.toHaveBeenCalled()
  })

  it("refuses to hand back a clientId owned by another account", async () => {
    mockPrisma.game.findUnique.mockResolvedValue({
      id: "someone-elses-game",
      clientId: "44444444-4444-4444-8444-444444444444",
      player1Id: OPPONENT_ID,
    } as never)

    const res = await POST(
      makeRequest(validBody({ clientId: "44444444-4444-4444-8444-444444444444" }))
    )

    expect(res.status).toBe(409)
    expect(mockPrisma.game.create).not.toHaveBeenCalled()
  })
})

describe("GET /api/game", () => {
  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/game")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("scopes results to the session user only (ignores userId param)", async () => {
    mockPrisma.game.findMany = vi.fn().mockResolvedValue([])
    const req = new NextRequest(
      `http://localhost:3000/api/game?userId=${OPPONENT_ID}&limit=abc`
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.game.findMany).toHaveBeenCalledTimes(1)
    const args = mockPrisma.game.findMany.mock.calls[0]![0]!
    expect(args.where!.OR).toEqual([
      { player1Id: USER_ID },
      { player2Id: USER_ID },
    ])
    // `limit=abc` falls back to 20 instead of producing NaN
    expect(args.take).toBe(20)
  })
})

import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess, parseLimit } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"
import { z } from "zod"

// Max legit score per question: base 100 + time bonus 50 + combo bonus 50
const MAX_SCORE_PER_QUESTION = 200
const MAX_QUESTIONS = 10

const questionSchema = z.object({
  type: z.string().min(1).max(20),
  options: z.array(z.string().max(500)).max(8),
  answer1: z.string().max(500).nullish(),
  answer2: z.string().max(500).nullish(),
  correct1: z.boolean().optional(),
  correct2: z.boolean().optional(),
  // Time may arrive as a float from client timers — validated as number here
  // and rounded to an integer at write time (the DB column is Int).
  time1: z.number().min(0).max(120_000).nullish(),
  time2: z.number().min(0).max(120_000).nullish(),
})

const gameSchema = z
  .object({
    mode: z.enum(["ai", "realtime", "async"]),
    wordLevel: z.enum(["CET4", "CET6", "TOEFL", "IELTS"]),
    // ids are Prisma uuid() defaults; an empty string means "no opponent"
    player2Id: z.union([z.string().uuid(), z.literal("")]).nullish(),
    score1: z.number().int().min(0),
    score2: z.number().int().min(0).nullish(),
    status: z.enum(["waiting", "playing", "finished"]).optional(),
    // Client-generated id for idempotent retries (same game POSTed twice is a no-op)
    clientId: z.string().uuid().optional(),
    questions: z.array(questionSchema).max(MAX_QUESTIONS).optional(),
  })
  .refine(
    (data) => {
      const totalQ = data.questions?.length ?? MAX_QUESTIONS
      return data.score1 <= totalQ * MAX_SCORE_PER_QUESTION
    },
    { message: "score1 超出该题量的合法上限", path: ["score1"] }
  )
  .refine(
    (data) => {
      if (data.score2 === undefined || data.score2 === null) return true
      const totalQ = data.questions?.length ?? MAX_QUESTIONS
      return data.score2 <= totalQ * MAX_SCORE_PER_QUESTION
    },
    { message: "score2 超出该题量的合法上限", path: ["score2"] }
  )

export async function POST(req: NextRequest) {
  try {
    // Identity comes from the session — the client can only save games for itself
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const parsed = gameSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "请求参数不合法", 400)
    }
    const { mode, wordLevel, player2Id, score1, score2, status, clientId, questions } = parsed.data

    const score2Value = score2 ?? 0
    const winnerId = score1 > score2Value ? session.userId : score2Value > score1 ? player2Id ?? null : null

    const isFinished = status === "finished" || !status

    // Idempotency: a retried POST with the same clientId returns the original game
    if (clientId) {
      const existing = await prisma.game.findUnique({
        where: { clientId },
        include: { questions: true },
      })
      if (existing) {
        return apiSuccess({ game: existing, duplicate: true })
      }
    }

    const game = await prisma.$transaction(async (tx) => {
      const createdGame = await tx.game.create({
        data: {
          clientId: clientId ?? null,
          mode,
          status: status || "finished",
          wordLevel,
          player1Id: session.userId,
          player2Id: player2Id || null,
          score1,
          score2: score2 ?? 0,
          winnerId,
          totalQ: questions?.length || MAX_QUESTIONS,
          finishedAt: isFinished ? new Date() : null,
          questions: questions
            ? {
                create: questions.map((q) => ({
                  type: q.type,
                  options: JSON.stringify(q.options),
                  answer1: q.answer1 ?? null,
                  answer2: q.answer2 ?? null,
                  correct1: q.correct1 || false,
                  correct2: q.correct2 || false,
                  time1: q.time1 == null ? null : Math.round(q.time1),
                  time2: q.time2 == null ? null : Math.round(q.time2),
                })),
              }
            : undefined,
        },
      })

      // Save scores for leaderboard in same transaction
      if (isFinished) {
        await tx.score.createMany({
          data: [
            { userId: session.userId, mode, level: wordLevel, score: score1 },
            ...(player2Id
              ? [{ userId: player2Id, mode, level: wordLevel, score: score2 ?? 0 }]
              : []),
          ],
        })
      }

      return createdGame
    })

    return apiSuccess({ game })
  } catch (error) {
    console.error("Save game error:", error)
    return apiError("保存游戏失败")
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode")
    const limit = parseLimit(searchParams.get("limit"), 20)

    // Users can only read their own match history
    const where: Record<string, unknown> = {
      OR: [{ player1Id: session.userId }, { player2Id: session.userId }],
    }
    if (mode) {
      where.mode = mode
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
        winner: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return apiSuccess({ games })
  } catch (error) {
    console.error("Get games error:", error)
    return apiError("获取游戏记录失败")
  }
}

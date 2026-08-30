import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"

const VALID_MODES = ["ai", "realtime", "async"]
const VALID_LEVELS = ["CET4", "CET6", "TOEFL", "IELTS"]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, wordLevel, player1Id, player2Id, score1, score2, questions, status } = body

    if (!player1Id) {
      return apiError("缺少玩家信息", 400)
    }

    if (mode && !VALID_MODES.includes(mode)) {
      return apiError("无效的游戏模式", 400)
    }

    if (wordLevel && !VALID_LEVELS.includes(wordLevel)) {
      return apiError("无效的词汇级别", 400)
    }

    const winnerId = score1 > score2 ? player1Id : score2 > score1 ? player2Id : null

    const game = await prisma.game.create({
      data: {
        mode,
        status: status || "finished",
        wordLevel,
        player1Id,
        player2Id: player2Id || null,
        score1,
        score2,
        winnerId,
        totalQ: questions?.length || 10,
        finishedAt: status === "finished" ? new Date() : null,
        questions: questions
          ? {
              create: questions.map((q: { wordId?: string; type: string; options: string[]; answer1?: string; answer2?: string; correct1?: boolean; correct2?: boolean; time1?: number; time2?: number }) => ({
                wordId: null,
                type: q.type,
                options: JSON.stringify(q.options),
                answer1: q.answer1,
                answer2: q.answer2,
                correct1: q.correct1 || false,
                correct2: q.correct2 || false,
                time1: q.time1,
                time2: q.time2,
              })),
            }
          : undefined,
      },
    })

    // Save scores for leaderboard
    if (status === "finished" || !status) {
      await prisma.score.createMany({
        data: [
          { userId: player1Id, mode, level: wordLevel, score: score1 },
          ...(player2Id
            ? [{ userId: player2Id, mode, level: wordLevel, score: score2 }]
            : []),
        ],
      })
    }

    return apiSuccess({ game })
  } catch (error) {
    console.error("Save game error:", error)
    return apiError("保存游戏失败")
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const mode = searchParams.get("mode")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: Record<string, unknown> = {}
    if (userId) {
      where.OR = [{ player1Id: userId }, { player2Id: userId }]
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

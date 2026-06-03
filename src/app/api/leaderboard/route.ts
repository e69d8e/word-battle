import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode")
    const level = searchParams.get("level")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: Record<string, string> = {}
    if (mode) where.mode = mode
    if (level) where.level = level

    const scores = await prisma.score.groupBy({
      by: ["userId"],
      where,
      _max: {
        score: true,
      },
      orderBy: {
        _max: {
          score: "desc",
        },
      },
      take: limit,
    })

    const userIds = scores.map((s) => s.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.username]))

    const leaderboard = scores.map((s, index) => ({
      rank: index + 1,
      userId: s.userId,
      username: userMap.get(s.userId) || "Unknown",
      score: s._max.score,
    }))

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error("Get leaderboard error:", error)
    return NextResponse.json(
      { error: "获取排行榜失败" },
      { status: 500 }
    )
  }
}

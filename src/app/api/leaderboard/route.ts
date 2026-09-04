import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"

interface LeaderboardCacheItem {
  timestamp: number
  data: Array<{
    rank: number
    userId: string
    username: string
    score: number | null
  }>
}

const leaderboardCache = new Map<string, LeaderboardCacheItem>()
const CACHE_TTL_MS = 15_000 // 15 seconds TTL

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode")
    const level = searchParams.get("level")
    const limit = parseInt(searchParams.get("limit") || "50")

    const cacheKey = `${mode || "all"}:${level || "all"}:${limit}`
    const cached = leaderboardCache.get(cacheKey)
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
    }

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return apiSuccess({ leaderboard: cached.data }, { headers: cacheHeaders })
    }

    const where: Record<string, string> = {}
    if (mode) where.mode = mode
    if (level) where.level = level

    const scores = await prisma.score.groupBy({
      by: ["userId"],
      where,
      _max: { score: true },
      orderBy: { _max: { score: "desc" } },
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

    leaderboardCache.set(cacheKey, {
      timestamp: Date.now(),
      data: leaderboard,
    })

    return apiSuccess({ leaderboard }, { headers: cacheHeaders })
  } catch (error) {
    console.error("Get leaderboard error:", error)
    return apiError("获取排行榜失败")
  }
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GameMode, WordLevel } from "@/types"

interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  score: number
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<GameMode | "all">("all")
  const [level, setLevel] = useState<WordLevel | "all">("all")

  useEffect(() => {
    async function loadLeaderboard() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (mode !== "all") params.set("mode", mode)
        if (level !== "all") params.set("level", level)
        params.set("limit", "50")

        const res = await fetch(`/api/leaderboard?${params}`)
        const data = await res.json()
        setLeaderboard(data.leaderboard || [])
      } catch (err) {
        console.error("Failed to load leaderboard:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadLeaderboard()
  }, [mode, level])

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇"
      case 2:
        return "🥈"
      case 3:
        return "🥉"
      default:
        return `#${rank}`
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">🏆 排行榜</h1>
      <p className="text-center text-gray-500 mb-8">查看全球玩家排名</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 justify-center mb-8">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "all" ? "primary" : "outline"}
            onClick={() => setMode("all")}
          >
            全部模式
          </Button>
          <Button
            size="sm"
            variant={mode === "ai" ? "primary" : "outline"}
            onClick={() => setMode("ai")}
          >
            人机对战
          </Button>
          <Button
            size="sm"
            variant={mode === "realtime" ? "primary" : "outline"}
            onClick={() => setMode("realtime")}
          >
            实时对战
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={level === "all" ? "secondary" : "outline"}
            onClick={() => setLevel("all")}
          >
            全部级别
          </Button>
          <Button
            size="sm"
            variant={level === "CET4" ? "secondary" : "outline"}
            onClick={() => setLevel("CET4")}
          >
            CET-4
          </Button>
          <Button
            size="sm"
            variant={level === "CET6" ? "secondary" : "outline"}
            onClick={() => setLevel("CET6")}
          >
            CET-6
          </Button>
        </div>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>最高分排名</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🎯</p>
              <p className="text-gray-500">暂无排名数据</p>
              <p className="text-sm text-gray-400">快去挑战一局吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                    entry.rank <= 3
                      ? "bg-gradient-to-r from-yellow-50 to-orange-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl w-12 text-center font-bold">
                      {getRankEmoji(entry.rank)}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{entry.username}</p>
                      {entry.rank <= 3 && (
                        <Badge variant={entry.rank === 1 ? "warning" : "info"} className="mt-1">
                          {entry.rank === 1 ? "王者" : entry.rank === 2 ? "大师" : "精英"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{entry.score}</p>
                    <p className="text-xs text-gray-400">分</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

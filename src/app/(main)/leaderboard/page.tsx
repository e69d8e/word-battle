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
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-2 tracking-tight">🏆 排行榜</h1>
      <p className="text-center text-muted mb-10">查看全球玩家排名</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 justify-center mb-10">
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
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted">加载中...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🎯</p>
              <p className="text-muted">暂无排名数据</p>
              <p className="text-sm text-muted-soft">快去挑战一局吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div
                  key={`${entry.userId}-${entry.rank}`}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    entry.rank <= 3
                      ? "bg-surface-cream-strong"
                      : "hover:bg-surface-soft"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl w-12 text-center font-bold">
                      {getRankEmoji(entry.rank)}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{entry.username}</p>
                      {entry.rank <= 3 && (
                        <Badge variant={entry.rank === 1 ? "coral" : "info"} className="mt-1">
                          {entry.rank === 1 ? "王者" : entry.rank === 2 ? "大师" : "精英"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-medium text-primary">{entry.score}</p>
                    <p className="text-xs text-muted">分</p>
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

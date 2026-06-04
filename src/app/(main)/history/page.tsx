"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import Link from "next/link"

interface GameHistory {
  id: string
  mode: string
  status: string
  wordLevel: string
  score1: number
  score2: number
  createdAt: string
  player1: { username: string }
  player2: { username: string } | null
}

export default function HistoryPage() {
  const { user } = useAuthStore()
  const [games, setGames] = useState<GameHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadGames() {
      if (!user) return
      try {
        const res = await fetch(`/api/game?userId=${user.id}`)
        const data = await res.json()
        setGames(data.games || [])
      } catch (err) {
        console.error("Failed to load games:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadGames()
  }, [user])

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted">请先登录</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-2 tracking-tight">游戏历史</h1>
      <p className="text-center text-muted mb-12">查看你的对战记录</p>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted">加载中...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted mb-5">暂无游戏记录</p>
          <Link href="/game">
            <Button>开始第一局游戏</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => {
            const isPlayer1 = game.player1.username === user.username
            const myScore = isPlayer1 ? game.score1 : game.score2
            const opponentScore = isPlayer1 ? game.score2 : game.score1
            const isWinner = myScore > opponentScore
            const isLoser = myScore < opponentScore
            const isDraw = myScore === opponentScore

            return (
              <Card key={game.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDraw ? "bg-accent-amber/15" : isWinner ? "bg-success/15" : "bg-error/15"
                      }`}>
                        <span className="text-lg">
                          {isDraw ? "🤝" : isWinner ? "🏆" : "😢"}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{game.player1.username}</span>
                          <span className="text-muted">VS</span>
                          <span className="font-medium text-ink">
                            {game.player2?.username || "AI 机器人"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="info">{game.mode === "ai" ? "人机对战" : game.mode === "realtime" ? "实时对战" : "异步挑战"}</Badge>
                          <Badge variant="default">{game.wordLevel}</Badge>
                          <span className="text-sm text-muted">
                            {new Date(game.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-medium">
                        <span className={isWinner ? "text-success" : isLoser ? "text-error" : "text-muted"}>
                          {myScore}
                        </span>
                        <span className="text-muted mx-1">-</span>
                        <span className={isLoser ? "text-success" : isWinner ? "text-error" : "text-muted"}>
                          {opponentScore}
                        </span>
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {isDraw ? "平局" : isWinner ? "胜利" : "失败"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">请先登录</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">游戏历史</h1>
      <p className="text-center text-gray-500 mb-10">查看你的对战记录</p>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">暂无游戏记录</p>
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
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDraw ? "bg-yellow-100" : isWinner ? "bg-green-100" : "bg-red-100"
                      }`}>
                        <span className="text-lg">
                          {isDraw ? "🤝" : isWinner ? "🏆" : "😢"}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{game.player1.username}</span>
                          <span className="text-gray-400">VS</span>
                          <span className="font-medium">
                            {game.player2?.username || "AI 机器人"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="info">{game.mode === "ai" ? "人机对战" : game.mode === "realtime" ? "实时对战" : "异步挑战"}</Badge>
                          <Badge variant="default">{game.wordLevel}</Badge>
                          <span className="text-sm text-gray-400">
                            {new Date(game.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        <span className={isWinner ? "text-green-600" : isLoser ? "text-red-600" : "text-gray-600"}>
                          {myScore}
                        </span>
                        <span className="text-gray-400 mx-1">-</span>
                        <span className={isLoser ? "text-green-600" : isWinner ? "text-red-600" : "text-gray-600"}>
                          {opponentScore}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
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

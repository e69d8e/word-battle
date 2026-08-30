"use client"

import { useState, useEffect, useMemo } from "react"
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
  const [filter, setFilter] = useState<"all" | "won" | "ai" | "realtime">("all")

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

  // Compute Career Statistics
  const stats = useMemo(() => {
    if (!user || games.length === 0) {
      return { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0, maxScore: 0 }
    }
    let wins = 0
    let losses = 0
    let draws = 0
    let maxScore = 0

    games.forEach((g) => {
      const isPlayer1 = g.player1.username === user.username
      const myScore = isPlayer1 ? g.score1 : g.score2
      const oppScore = isPlayer1 ? g.score2 : g.score1
      if (myScore > maxScore) maxScore = myScore

      if (myScore > oppScore) wins++
      else if (myScore < oppScore) losses++
      else draws++
    })

    const winRate = games.length > 0 ? Math.round((wins / games.length) * 100) : 0
    return { total: games.length, wins, losses, draws, winRate, maxScore }
  }, [user, games])

  const filteredGames = useMemo(() => {
    if (!user) return []
    return games.filter((g) => {
      const isPlayer1 = g.player1.username === user.username
      const myScore = isPlayer1 ? g.score1 : g.score2
      const oppScore = isPlayer1 ? g.score2 : g.score1
      const isWinner = myScore > oppScore

      if (filter === "won") return isWinner
      if (filter === "ai") return g.mode === "ai"
      if (filter === "realtime") return g.mode === "realtime"
      return true
    })
  }, [games, filter, user])

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-muted mb-4">请登录后查看历史战绩</p>
        <Link href="/login">
          <Button variant="primary">前往登录</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          📜 BATTLE LOGS
        </span>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-ink mt-3 mb-2 tracking-tight">
          历史战报
        </h1>
        <p className="text-muted text-sm md:text-base">回溯每一场单词竞技，见证你的词汇成长之路</p>
      </div>

      {/* Career Stats Dashboard */}
      {!isLoading && games.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <Card className="border-hairline bg-surface-card p-4 text-center">
            <p className="text-xs text-muted font-medium mb-1">总对战局数</p>
            <p className="font-display text-3xl font-black text-ink">{stats.total}</p>
            <p className="text-[11px] text-muted-soft mt-1">生涯场次</p>
          </Card>

          <Card className="border-hairline bg-surface-card p-4 text-center">
            <p className="text-xs text-muted font-medium mb-1">综合胜率</p>
            <p className="font-display text-3xl font-black text-primary">{stats.winRate}%</p>
            <p className="text-[11px] text-success mt-1">{stats.wins} 胜 · {stats.losses} 负 · {stats.draws} 平</p>
          </Card>

          <Card className="border-hairline bg-surface-card p-4 text-center">
            <p className="text-xs text-muted font-medium mb-1">历史最高得分</p>
            <p className="font-display text-3xl font-black text-accent-amber">{stats.maxScore}</p>
            <p className="text-[11px] text-muted-soft mt-1">单局巅峰</p>
          </Card>

          <Card className="border-hairline bg-surface-card p-4 text-center">
            <p className="text-xs text-muted font-medium mb-1">段位表现</p>
            <p className="font-display text-2xl font-bold text-ink mt-1">
              {stats.winRate >= 80 ? "👑 王者" : stats.winRate >= 60 ? "⚡ 大师" : "🎯 新星"}
            </p>
            <p className="text-[11px] text-muted-soft mt-1.5">竞技评估</p>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      {!isLoading && games.length > 0 && (
        <div className="flex justify-center mb-6">
          <div className="flex bg-surface-card p-1 rounded-xl border border-hairline">
            {[
              { id: "all", label: `全部 (${games.length})` },
              { id: "won", label: `胜利 (${stats.wins})` },
              { id: "ai", label: "人机对战" },
              { id: "realtime", label: "实时竞技" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === tab.id
                    ? "bg-primary text-on-primary font-semibold shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Games List */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted text-sm">加载历史战报中...</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="text-center py-16 bg-surface-card rounded-2xl border border-hairline p-8 space-y-4">
          <p className="text-5xl">⚔️</p>
          <p className="text-ink font-semibold text-lg">暂无匹配的战绩记录</p>
          <p className="text-sm text-muted">去开始一场快节奏的英语对战吧！</p>
          <Link href="/game">
            <Button variant="primary" size="lg" className="mt-2 shadow-xs">
              🚀 开始新对局
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGames.map((game) => {
            const isPlayer1 = game.player1.username === user.username
            const myScore = isPlayer1 ? game.score1 : game.score2
            const opponentScore = isPlayer1 ? game.score2 : game.score1
            const isWinner = myScore > opponentScore
            const isLoser = myScore < opponentScore
            const isDraw = myScore === opponentScore
            const opponentName = (isPlayer1 ? game.player2?.username : game.player1.username) || "AI 机器人"

            return (
              <Card
                key={game.id}
                className={`transition-all hover:shadow-sm border ${
                  isWinner
                    ? "bg-canvas border-primary/20 hover:border-primary/40"
                    : "bg-surface-card border-hairline-soft"
                }`}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left details */}
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 shadow-xs ${
                          isDraw
                            ? "bg-accent-amber/20 text-accent-amber"
                            : isWinner
                            ? "bg-success/20 text-success ring-2 ring-success/20"
                            : "bg-error/15 text-error"
                        }`}
                      >
                        {isDraw ? "🤝" : isWinner ? "👑" : "😢"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-sm md:text-base">{user.username}</span>
                          <span className="text-xs text-muted font-mono font-bold">VS</span>
                          <span className="font-semibold text-ink text-sm md:text-base text-muted-soft">
                            {opponentName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge variant={game.mode === "realtime" ? "coral" : "info"} className="text-[10px]">
                            {game.mode === "ai" ? "🤖 人机" : game.mode === "realtime" ? "⚡ 实时" : "📨 异步"}
                          </Badge>
                          <Badge variant="default" className="text-[10px]">{game.wordLevel}</Badge>
                          <span className="text-xs text-muted font-mono">
                            {new Date(game.createdAt).toLocaleString("zh-CN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right score display */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-hairline-soft">
                      <div className="font-display text-2xl md:text-3xl font-bold tracking-tight">
                        <span className={isWinner ? "text-success font-black" : isLoser ? "text-error" : "text-muted"}>
                          {myScore}
                        </span>
                        <span className="text-muted-soft mx-1 text-lg">:</span>
                        <span className={isLoser ? "text-success font-black" : isWinner ? "text-error" : "text-muted"}>
                          {opponentScore}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full ${
                          isDraw
                            ? "bg-accent-amber/15 text-accent-amber"
                            : isWinner
                            ? "bg-success/15 text-success"
                            : "bg-error/15 text-error"
                        }`}
                      >
                        {isDraw ? "平局" : isWinner ? "胜出 (+胜场)" : "战败"}
                      </span>
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

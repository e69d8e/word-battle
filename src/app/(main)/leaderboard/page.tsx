"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import type { GameMode, WordLevel } from "@/types"

interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  score: number
}

export default function LeaderboardPage() {
  const { user } = useAuthStore()
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

  const top3 = leaderboard.slice(0, 3)
  const myEntry = user ? leaderboard.find((e) => e.username === user.username) : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          🏆 HALL OF FAME
        </span>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-ink mt-3 mb-2 tracking-tight">
          天梯排行榜
        </h1>
        <p className="text-muted text-sm md:text-base">与全国词汇王者同台竞技，刷新你的巅峰战力</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
        {/* Mode filter */}
        <div className="flex bg-surface-card p-1 rounded-xl border border-hairline">
          {[
            { id: "all", label: "全部模式" },
            { id: "ai", label: "人机模式" },
            { id: "realtime", label: "实时竞技" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id as GameMode | "all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === item.id
                  ? "bg-primary text-on-primary font-semibold shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex bg-surface-card p-1 rounded-xl border border-hairline">
          {[
            { id: "all", label: "全部级别" },
            { id: "CET4", label: "CET-4" },
            { id: "CET6", label: "CET-6" },
            { id: "TOEFL", label: "TOEFL" },
            { id: "IELTS", label: "IELTS" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLevel(item.id as WordLevel | "all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                level === item.id
                  ? "bg-canvas text-ink font-semibold shadow-xs border border-hairline-soft"
                  : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium (when available and not loading) */}
      {!isLoading && top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8 items-end max-w-2xl mx-auto pt-6">
          {/* 2nd Place */}
          {top3[1] ? (
            <div className="bg-surface-card/90 border border-hairline rounded-2xl p-4 text-center space-y-2 shadow-xs transform translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 mx-auto rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold shadow-xs border-2 border-white">
                🥈
              </div>
              <p className="font-semibold text-xs md:text-sm text-ink truncate">{top3[1].username}</p>
              <p className="font-display text-xl md:text-2xl font-bold text-primary">{top3[1].score}</p>
              <Badge variant="info" className="text-[10px] scale-90">亚军 · 大师</Badge>
            </div>
          ) : <div />}

          {/* 1st Place (Center elevated) */}
          {top3[0] && (
            <div className="bg-gradient-to-b from-surface-card to-surface-cream-strong border-2 border-primary/30 rounded-2xl p-5 text-center space-y-2 shadow-md relative -translate-y-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</div>
              <div className="w-14 h-14 md:w-16 md:h-16 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-bold shadow-xs border-2 border-amber-300">
                🥇
              </div>
              <p className="font-bold text-sm md:text-base text-ink truncate">{top3[0].username}</p>
              <p className="font-display text-2xl md:text-3xl font-black text-primary">{top3[0].score}</p>
              <Badge variant="coral" className="text-[10px] shadow-xs">冠军 · 王者</Badge>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] ? (
            <div className="bg-surface-card/90 border border-hairline rounded-2xl p-4 text-center space-y-2 shadow-xs transform translate-y-4">
              <div className="w-12 h-12 md:w-14 md:h-14 mx-auto rounded-full bg-amber-200/60 text-amber-800 flex items-center justify-center text-xl font-bold shadow-xs border-2 border-white">
                🥉
              </div>
              <p className="font-semibold text-xs md:text-sm text-ink truncate">{top3[2].username}</p>
              <p className="font-display text-xl md:text-2xl font-bold text-primary">{top3[2].score}</p>
              <Badge variant="warning" className="text-[10px] scale-90">季军 · 精英</Badge>
            </div>
          ) : <div />}
        </div>
      )}

      {/* Leaderboard Table Card */}
      <Card className="border-hairline shadow-sm overflow-hidden">
        <CardHeader className="bg-surface-soft/60 border-b border-hairline pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">排名详情</CardTitle>
          <span className="text-xs text-muted font-mono">TOP 50 RANKINGS</span>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted text-sm">加载排行榜单中...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-5xl">🎯</p>
              <p className="text-ink font-semibold text-base">暂无该筛选条件下的排名数据</p>
              <p className="text-xs text-muted">赶紧开启第一局 PK，抢占榜首！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => {
                const isMe = user?.username === entry.username
                return (
                  <div
                    key={`${entry.userId}-${entry.rank}`}
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                      isMe
                        ? "bg-primary/10 border border-primary/30 shadow-xs"
                        : entry.rank <= 3
                        ? "bg-surface-card hover:bg-surface-cream-strong"
                        : "hover:bg-surface-soft/70 border border-transparent hover:border-hairline-soft"
                    }`}
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className="w-8 text-center font-display font-bold text-base md:text-lg text-muted">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-surface-cream-strong flex items-center justify-center font-semibold text-xs text-ink">
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-ink flex items-center gap-1.5">
                            <span>{entry.username}</span>
                            {isMe && <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.2 rounded font-normal">我</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-baseline gap-1">
                      <span className="font-display text-2xl font-bold text-primary">{entry.score}</span>
                      <span className="text-xs text-muted">分</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky My Rank Bar */}
      {user && myEntry && (
        <div className="sticky bottom-4 mt-6 p-4 bg-surface-dark text-on-dark rounded-2xl shadow-xl flex items-center justify-between border border-surface-dark-elevated animate-countdown-pop">
          <div className="flex items-center gap-3">
            <span className="text-xs bg-primary text-on-primary px-2.5 py-1 rounded-full font-bold">我的排名</span>
            <span className="font-display text-xl font-bold">第 #{myEntry.rank} 名</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-on-dark-soft">最佳得分:</span>
            <span className="font-display text-2xl font-bold text-primary">{myEntry.score}</span>
            <span className="text-xs text-on-dark-soft">分</span>
          </div>
        </div>
      )}
    </div>
  )
}

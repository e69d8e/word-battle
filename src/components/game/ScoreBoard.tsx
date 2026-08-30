"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface PlayerScoreInfo {
  name: string
  score: number
  correctCount?: number
  combo?: number
  lastScoreGained?: number
  isMe?: boolean
}

interface ScoreBoardProps {
  player1: PlayerScoreInfo
  player2: PlayerScoreInfo
  currentQuestion: number
  totalQuestions: number
}

export const ScoreBoard = React.memo(function ScoreBoard({
  player1,
  player2,
  currentQuestion,
  totalQuestions,
}: ScoreBoardProps) {
  const leading = player1.score > player2.score ? 1 : player2.score > player1.score ? 2 : 0

  return (
    <div className="relative bg-surface-card/90 backdrop-blur-md rounded-2xl border border-hairline p-4 md:p-6 shadow-sm overflow-hidden">
      {/* Background ambient accent */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between relative z-10">
        {/* Player 1 */}
        <div
          className={cn(
            "text-center flex-1 p-3 rounded-xl transition-all duration-300 relative",
            leading === 1 && "bg-canvas/80 shadow-xs border border-primary/20"
          )}
        >
          {/* Floating score indicator */}
          {player1.lastScoreGained && player1.lastScoreGained > 0 ? (
            <div
              key={`${currentQuestion}-${player1.score}`}
              className="absolute -top-3 left-1/2 -translate-x-1/2 animate-float-score font-mono font-bold text-xs md:text-sm text-success bg-canvas px-2 py-0.5 rounded-full border border-success/30 shadow-xs whitespace-nowrap z-20"
            >
              +{player1.lastScoreGained}
            </div>
          ) : null}

          {/* Name & Badge */}
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {player1.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-medium text-ink truncate max-w-[90px] md:max-w-[140px]">{player1.name}</p>
            {player1.isMe !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-semibold",
                  player1.isMe ? "bg-primary text-on-primary" : "bg-surface-cream-strong text-muted"
                )}
              >
                {player1.isMe ? "我" : "敌"}
              </span>
            )}
          </div>

          {/* Score */}
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={cn(
                "font-display text-3xl md:text-4xl font-bold tabular-nums tracking-tight transition-colors",
                leading === 1 ? "text-primary" : "text-ink"
              )}
            >
              {player1.score}
            </span>
          </div>

          {/* Stats & Combo */}
          <div className="flex items-center justify-center gap-2 mt-1.5">
            {player1.correctCount !== undefined && (
              <span className="text-[11px] text-muted font-medium">✓ {player1.correctCount} 题</span>
            )}
            {player1.combo && player1.combo >= 2 ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-accent-amber bg-accent-amber/15 px-2 py-0.5 rounded-full animate-combo-pulse border border-accent-amber/30">
                <span>🔥</span> {player1.combo} 连击
              </span>
            ) : null}
            {leading === 1 && !player1.combo && (
              <span className="text-[10px] bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full">
                👑 领先
              </span>
            )}
          </div>
        </div>

        {/* Center Round Counter & VS */}
        <div className="flex flex-col items-center px-3 md:px-6 shrink-0">
          <div className="relative">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-primary to-accent-amber flex items-center justify-center shadow-xs border-2 border-canvas">
              <span className="text-on-primary font-black text-xs md:text-sm tracking-wider">VS</span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="text-[11px] font-mono font-medium text-muted bg-surface-cream-strong px-2.5 py-0.5 rounded-full border border-hairline-soft">
              第 {currentQuestion}/{totalQuestions} 题
            </span>
          </div>
        </div>

        {/* Player 2 */}
        <div
          className={cn(
            "text-center flex-1 p-3 rounded-xl transition-all duration-300 relative",
            leading === 2 && "bg-canvas/80 shadow-xs border border-primary/20"
          )}
        >
          {/* Floating score indicator for Player 2 */}
          {player2.lastScoreGained && player2.lastScoreGained > 0 ? (
            <div
              key={`${currentQuestion}-${player2.score}`}
              className="absolute -top-3 left-1/2 -translate-x-1/2 animate-float-score font-mono font-bold text-xs md:text-sm text-success bg-canvas px-2 py-0.5 rounded-full border border-success/30 shadow-xs whitespace-nowrap z-20"
            >
              +{player2.lastScoreGained}
            </div>
          ) : null}

          {/* Name & Badge */}
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-surface-cream-strong text-muted-soft flex items-center justify-center text-xs font-bold">
              {player2.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-medium text-ink truncate max-w-[90px] md:max-w-[140px]">{player2.name}</p>
            {player2.isMe !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-semibold",
                  player2.isMe ? "bg-primary text-on-primary" : "bg-surface-cream-strong text-muted"
                )}
              >
                {player2.isMe ? "我" : "敌"}
              </span>
            )}
          </div>

          {/* Score */}
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={cn(
                "font-display text-3xl md:text-4xl font-bold tabular-nums tracking-tight transition-colors",
                leading === 2 ? "text-primary" : "text-ink"
              )}
            >
              {player2.score}
            </span>
          </div>

          {/* Stats & Combo */}
          <div className="flex items-center justify-center gap-2 mt-1.5">
            {player2.correctCount !== undefined && (
              <span className="text-[11px] text-muted font-medium">✓ {player2.correctCount} 题</span>
            )}
            {player2.combo && player2.combo >= 2 ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-accent-amber bg-accent-amber/15 px-2 py-0.5 rounded-full animate-combo-pulse border border-accent-amber/30">
                <span>🔥</span> {player2.combo} 连击
              </span>
            ) : null}
            {leading === 2 && !player2.combo && (
              <span className="text-[10px] bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full">
                👑 领先
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

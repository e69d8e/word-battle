"use client"

import { cn } from "@/lib/utils"

interface ScoreBoardProps {
  player1: { name: string; score: number; correctCount?: number; isMe?: boolean }
  player2: { name: string; score: number; correctCount?: number; isMe?: boolean }
  currentQuestion: number
  totalQuestions: number
}

export function ScoreBoard({ player1, player2, currentQuestion, totalQuestions }: ScoreBoardProps) {
  const leading = player1.score > player2.score ? 1 : player2.score > player1.score ? 2 : 0

  return (
    <div className="flex items-center justify-between bg-canvas rounded-lg border border-hairline p-5">
      {/* Player 1 */}
      <div className={cn(
        "text-center flex-1",
        leading === 1 && "scale-105"
      )}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-sm text-muted">{player1.name}</p>
          {player1.isMe !== undefined && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              player1.isMe ? "bg-primary/15 text-primary" : "bg-surface-card text-muted"
            )}>
              {player1.isMe ? "我方" : "对方"}
            </span>
          )}
        </div>
        <p className={cn(
          "font-display text-4xl font-medium tabular-nums",
          leading === 1 ? "text-primary" : "text-ink"
        )}>
          {player1.score}
        </p>
        {player1.correctCount !== undefined && (
          <p className="text-xs text-success mt-1">✓ {player1.correctCount}题</p>
        )}
        {leading === 1 && (
          <span className="inline-block mt-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
            领先
          </span>
        )}
      </div>

      {/* VS / Progress */}
      <div className="flex flex-col items-center px-6">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
          <span className="text-on-primary font-bold text-sm">VS</span>
        </div>
        <p className="text-xs text-muted mt-2">
          {currentQuestion}/{totalQuestions}
        </p>
      </div>

      {/* Player 2 */}
      <div className={cn(
        "text-center flex-1",
        leading === 2 && "scale-105"
      )}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-sm text-muted">{player2.name}</p>
          {player2.isMe !== undefined && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              player2.isMe ? "bg-primary/15 text-primary" : "bg-surface-card text-muted"
            )}>
              {player2.isMe ? "我方" : "对方"}
            </span>
          )}
        </div>
        <p className={cn(
          "font-display text-4xl font-medium tabular-nums",
          leading === 2 ? "text-primary" : "text-ink"
        )}>
          {player2.score}
        </p>
        {player2.correctCount !== undefined && (
          <p className="text-xs text-success mt-1">✓ {player2.correctCount}题</p>
        )}
        {leading === 2 && (
          <span className="inline-block mt-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
            领先
          </span>
        )}
      </div>
    </div>
  )
}

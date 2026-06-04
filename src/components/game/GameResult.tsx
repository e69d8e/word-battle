"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { GameResult as GameResultType } from "@/types"

interface GameResultProps {
  result: GameResultType
  currentUsername?: string
  onPlayAgain: () => void
  onBackToMenu: () => void
}

export function GameResult({ result, currentUsername, onPlayAgain, onBackToMenu }: GameResultProps) {
  const isPlayer1Winner = result.winner === result.player1.username
  const isPlayer2Winner = result.winner === result.player2.username
  const isDraw = !result.winner
  const isCurrentUserWinner = currentUsername
    ? (isPlayer1Winner && result.player1.username === currentUsername) ||
      (isPlayer2Winner && result.player2.username === currentUsername)
    : isPlayer1Winner

  const correct1 = result.questions.filter((q) => q.correct1).length
  const correct2 = result.questions.filter((q) => q.correct2).length
  const accuracy1 = Math.round((correct1 / result.questions.length) * 100)
  const accuracy2 = Math.round((correct2 / result.questions.length) * 100)

  return (
    <div className="space-y-6">
      {/* Result Header */}
      <div className="text-center py-6">
        <div className={cn(
          "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4",
          isDraw ? "bg-accent-amber/15" : isCurrentUserWinner ? "bg-success/15" : "bg-error/15"
        )}>
          <span className="text-5xl">
            {isDraw ? "🤝" : isCurrentUserWinner ? "🏆" : "😢"}
          </span>
        </div>
        <h2 className="font-display text-3xl font-medium text-ink mb-2">
          {isDraw ? "平局！" : isCurrentUserWinner ? "恭喜你赢了！" : "很遗憾，你输了"}
        </h2>
        <p className="text-muted">
          {isDraw
            ? "势均力敌，下次再战！"
            : isCurrentUserWinner
            ? "表现出色，继续保持！"
            : "不要气馁，继续加油！"}
        </p>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-3 gap-4">
        <div className={cn(
          "text-center p-5 rounded-lg",
          isPlayer1Winner ? "bg-primary/10 border-2 border-primary/20" : "bg-surface-card"
        )}>
          <p className="text-sm text-muted mb-1">{result.player1.username}</p>
          <p className="font-display text-4xl font-medium text-primary">{result.player1.score}</p>
          <p className="text-xs text-muted mt-1">正确率 {accuracy1}%</p>
          {isPlayer1Winner && <span className="text-xs">👑</span>}
        </div>

        <div className="flex items-center justify-center">
          <span className="font-display text-2xl font-medium text-muted">VS</span>
        </div>

        <div className={cn(
          "text-center p-5 rounded-lg",
          isPlayer2Winner ? "bg-primary/10 border-2 border-primary/20" : "bg-surface-card"
        )}>
          <p className="text-sm text-muted mb-1">{result.player2.username}</p>
          <p className="font-display text-4xl font-medium text-primary">{result.player2.score}</p>
          <p className="text-xs text-muted mt-1">正确率 {accuracy2}%</p>
          {isPlayer2Winner && <span className="text-xs">👑</span>}
        </div>
      </div>

      {/* Question Details */}
      <div className="space-y-2">
        <h3 className="font-medium text-ink">答题详情</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {result.questions.map((q, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-surface-card rounded-lg text-sm">
              <span className="font-medium text-ink">{q.word}</span>
              <div className="flex items-center gap-4">
                <span className={cn(
                  "px-2 py-0.5 rounded",
                  q.correct1 ? "bg-success/15 text-success" : "bg-error/15 text-error"
                )}>
                  {result.player1.username}: {q.correct1 ? "✓" : "✗"}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded",
                  q.correct2 ? "bg-success/15 text-success" : "bg-error/15 text-error"
                )}>
                  {result.player2.username}: {q.correct2 ? "✓" : "✗"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="primary" className="flex-1" onClick={onPlayAgain}>
          再来一局
        </Button>
        <Button variant="outline" className="flex-1" onClick={onBackToMenu}>
          返回菜单
        </Button>
      </div>
    </div>
  )
}

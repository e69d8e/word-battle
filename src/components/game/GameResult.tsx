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
          isDraw ? "bg-yellow-100" : isCurrentUserWinner ? "bg-green-100" : "bg-red-100"
        )}>
          <span className="text-5xl">
            {isDraw ? "🤝" : isCurrentUserWinner ? "🏆" : "😢"}
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {isDraw ? "平局！" : isCurrentUserWinner ? "恭喜你赢了！" : "很遗憾，你输了"}
        </h2>
        <p className="text-gray-500">
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
          "text-center p-4 rounded-xl",
          isPlayer1Winner ? "bg-blue-50 border-2 border-blue-200" : "bg-gray-50"
        )}>
          <p className="text-sm text-gray-500 mb-1">{result.player1.username}</p>
          <p className="text-3xl font-bold text-blue-600">{result.player1.score}</p>
          <p className="text-xs text-gray-400 mt-1">正确率 {accuracy1}%</p>
          {isPlayer1Winner && <span className="text-xs">👑</span>}
        </div>

        <div className="flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-300">VS</span>
        </div>

        <div className={cn(
          "text-center p-4 rounded-xl",
          isPlayer2Winner ? "bg-purple-50 border-2 border-purple-200" : "bg-gray-50"
        )}>
          <p className="text-sm text-gray-500 mb-1">{result.player2.username}</p>
          <p className="text-3xl font-bold text-purple-600">{result.player2.score}</p>
          <p className="text-xs text-gray-400 mt-1">正确率 {accuracy2}%</p>
          {isPlayer2Winner && <span className="text-xs">👑</span>}
        </div>
      </div>

      {/* Question Details */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-700">答题详情</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {result.questions.map((q, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <span className="font-medium">{q.word}</span>
              <div className="flex items-center gap-4">
                <span className={cn("px-2 py-0.5 rounded", q.correct1 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                  {result.player1.username}: {q.correct1 ? "✓" : "✗"}
                </span>
                <span className={cn("px-2 py-0.5 rounded", q.correct2 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
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

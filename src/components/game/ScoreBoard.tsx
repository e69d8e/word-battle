"use client"

import { cn } from "@/lib/utils"

interface ScoreBoardProps {
  player1: { name: string; score: number }
  player2: { name: string; score: number }
  currentQuestion: number
  totalQuestions: number
}

export function ScoreBoard({ player1, player2, currentQuestion, totalQuestions }: ScoreBoardProps) {
  const leading = player1.score > player2.score ? 1 : player2.score > player1.score ? 2 : 0

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {/* Player 1 */}
      <div className={cn(
        "text-center flex-1",
        leading === 1 && "scale-105"
      )}>
        <p className="text-sm text-gray-500 mb-1">{player1.name}</p>
        <p className={cn(
          "text-3xl font-bold tabular-nums",
          leading === 1 ? "text-blue-600" : "text-gray-700"
        )}>
          {player1.score}
        </p>
        {leading === 1 && (
          <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
            领先
          </span>
        )}
      </div>

      {/* VS / Progress */}
      <div className="flex flex-col items-center px-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">VS</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {currentQuestion}/{totalQuestions}
        </p>
      </div>

      {/* Player 2 */}
      <div className={cn(
        "text-center flex-1",
        leading === 2 && "scale-105"
      )}>
        <p className="text-sm text-gray-500 mb-1">{player2.name}</p>
        <p className={cn(
          "text-3xl font-bold tabular-nums",
          leading === 2 ? "text-purple-600" : "text-gray-700"
        )}>
          {player2.score}
        </p>
        {leading === 2 && (
          <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
            领先
          </span>
        )}
      </div>
    </div>
  )
}

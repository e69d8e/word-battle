"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSpeech } from "@/hooks/useSpeech"
import type { GameResult as GameResultType } from "@/types"

interface GameResultProps {
  result: GameResultType
  currentUsername?: string
  onPlayAgain: () => void
  onBackToMenu: () => void
  isWaitingForRematch?: boolean
  opponentWantsRematch?: boolean
}

export function GameResult({
  result,
  currentUsername,
  onPlayAgain,
  onBackToMenu,
  isWaitingForRematch,
  opponentWantsRematch,
}: GameResultProps) {
  const [filter, setFilter] = useState<"all" | "wrong" | "correct">("all")
  const [copied, setCopied] = useState(false)
  const { speak } = useSpeech()

  const isPlayer1Winner = result.winner === result.player1.username
  const isPlayer2Winner = result.winner === result.player2.username
  const isDraw = !result.winner
  const isCurrentUserWinner = currentUsername
    ? (isPlayer1Winner && result.player1.username === currentUsername) ||
      (isPlayer2Winner && result.player2.username === currentUsername)
    : isPlayer1Winner

  const correct1 = result.questions.filter((q) => q.correct1).length
  const correct2 = result.questions.filter((q) => q.correct2).length
  const accuracy1 = result.player1.accuracy ?? Math.round((correct1 / result.questions.length) * 100)
  const accuracy2 = result.player2.accuracy ?? Math.round((correct2 / result.questions.length) * 100)

  const wrongCount1 = result.questions.length - correct1

  const filteredQuestions = result.questions.filter((q) => {
    if (filter === "wrong") return !q.correct1
    if (filter === "correct") return q.correct1
    return true
  })

  const copyBattleReport = () => {
    const winnerName = result.winner || "势均力敌（平局）"
    const text = `⚔️ Word Battle 单词对战战报\n` +
      `🏆 获胜者：${winnerName}\n` +
      `📊 我的成绩：${result.player1.score} 分 (正确率 ${accuracy1}% | 最高连击 ${result.player1.maxCombo ?? 0})\n` +
      `⚡ 对手成绩：${result.player2.score} 分 (正确率 ${accuracy2}%)\n` +
      `🎯 快来 Word Battle 与我一较高下！`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="space-y-6 animate-countdown-pop">
      {/* Result Hero Header */}
      <div className="text-center py-6 bg-surface-card rounded-2xl border border-hairline relative overflow-hidden shadow-xs">
        <div
          className={cn(
            "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 shadow-inner",
            isDraw
              ? "bg-accent-amber/20 ring-8 ring-accent-amber/10"
              : isCurrentUserWinner
              ? "bg-success/20 ring-8 ring-success/10"
              : "bg-error/20 ring-8 ring-error/10"
          )}
        >
          <span className="text-5xl animate-bounce">
            {isDraw ? "🤝" : isCurrentUserWinner ? "👑" : "😢"}
          </span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-ink mb-1.5 tracking-tight">
          {isDraw ? "势均力敌 · 平局！" : isCurrentUserWinner ? "恭喜凯旋 · 获得胜利！" : "惜败对手 · 继续加油！"}
        </h2>
        <p className="text-muted text-sm max-w-sm mx-auto">
          {isDraw
            ? "双方实力难解难分，再来一局决出胜负！"
            : isCurrentUserWinner
            ? "词汇储备惊人，反应敏捷，继续保持连胜！"
            : "胜败乃兵家常事，复习错题助你卷土重来！"}
        </p>
      </div>

      {/* Metric Cards Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Player 1 Card */}
        <div
          className={cn(
            "p-5 rounded-xl border transition-all",
            isPlayer1Winner
              ? "bg-canvas border-primary/40 shadow-xs ring-1 ring-primary/20"
              : "bg-surface-card border-hairline"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <span>{result.player1.username}</span>
              <span className="text-xs font-normal text-muted">(我方)</span>
            </span>
            {isPlayer1Winner && <span className="text-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full">🏆 WINNER</span>}
          </div>
          <p className="font-display text-4xl font-black text-primary tracking-tight mb-4">
            {result.player1.score} <span className="text-sm font-normal text-muted font-sans">分</span>
          </p>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-hairline-soft text-center">
            <div>
              <p className="text-[11px] text-muted">正确率</p>
              <p className="font-semibold text-ink text-sm mt-0.5">{accuracy1}%</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">最高连击</p>
              <p className="font-semibold text-accent-amber text-sm mt-0.5">🔥 {result.player1.maxCombo ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">均速</p>
              <p className="font-semibold text-ink text-sm mt-0.5">{result.player1.avgTime ?? 0}s</p>
            </div>
          </div>
        </div>

        {/* Player 2 Card */}
        <div
          className={cn(
            "p-5 rounded-xl border transition-all",
            isPlayer2Winner
              ? "bg-canvas border-primary/40 shadow-xs ring-1 ring-primary/20"
              : "bg-surface-card border-hairline"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <span>{result.player2.username}</span>
              <span className="text-xs font-normal text-muted">(对手)</span>
            </span>
            {isPlayer2Winner && <span className="text-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full">🏆 WINNER</span>}
          </div>
          <p className="font-display text-4xl font-black text-primary tracking-tight mb-4">
            {result.player2.score} <span className="text-sm font-normal text-muted font-sans">分</span>
          </p>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-hairline-soft text-center">
            <div>
              <p className="text-[11px] text-muted">正确率</p>
              <p className="font-semibold text-ink text-sm mt-0.5">{accuracy2}%</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">最高连击</p>
              <p className="font-semibold text-accent-amber text-sm mt-0.5">🔥 {result.player2.maxCombo ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">均速</p>
              <p className="font-semibold text-ink text-sm mt-0.5">{result.player2.avgTime ?? 0}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mistake Notebook & Question Review */}
      <div className="bg-surface-card rounded-2xl border border-hairline p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline-soft pb-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <span>📖 答题与错题复习</span>
            </h3>
            <p className="text-xs text-muted">点击小喇叭可随时听标准美音发音</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-surface-cream-strong p-1 rounded-lg">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                filter === "all" ? "bg-canvas text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              全部 ({result.questions.length})
            </button>
            <button
              onClick={() => setFilter("wrong")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                filter === "wrong" ? "bg-error text-on-primary shadow-xs" : "text-error hover:bg-error/10"
              )}
            >
              仅错题 ({wrongCount1})
            </button>
            <button
              onClick={() => setFilter("correct")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                filter === "correct" ? "bg-success text-on-primary shadow-xs" : "text-success hover:bg-success/10"
              )}
            >
              答对 ({correct1})
            </button>
          </div>
        </div>

        {/* Word List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {filteredQuestions.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">🎉 没有符合条件的题目！</p>
          ) : (
            filteredQuestions.map((q, i) => (
              <div
                key={i}
                className={cn(
                  "p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                  q.correct1
                    ? "bg-canvas/60 border-hairline-soft"
                    : "bg-error/5 border-error/20"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-base">{q.word}</span>
                    {q.phonetic && (
                      <span className="text-xs font-mono text-muted">{q.phonetic}</span>
                    )}
                    <button
                      onClick={() => speak(q.word)}
                      className="p-1 rounded-md hover:bg-surface-cream-strong text-primary transition-colors text-sm"
                      title="播放发音"
                    >
                      🔊
                    </button>
                  </div>
                  {q.meaningCn && (
                    <p className="text-xs text-body">
                      <span className="font-medium text-primary">{q.meaningCn}</span>
                      {q.meaning && <span className="text-muted ml-1">· {q.meaning}</span>}
                    </p>
                  )}
                  {q.example && (
                    <p className="text-[11px] text-muted-soft italic pt-0.5">
                      &ldquo;{q.example}&rdquo;
                    </p>
                  )}
                </div>

                {/* Badges for Player1 & Player2 */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-semibold",
                      q.correct1 ? "bg-success/15 text-success" : "bg-error/15 text-error"
                    )}
                  >
                    我方: {q.correct1 ? "✓ 对" : "✗ 错"}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-semibold",
                      q.correct2 ? "bg-success/15 text-success" : "bg-error/15 text-error"
                    )}
                  >
                    对手: {q.correct2 ? "✓ 对" : "✗ 错"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rematch Notification */}
      {opponentWantsRematch && !isWaitingForRematch && (
        <div className="text-center p-3.5 bg-primary/10 border border-primary/20 rounded-xl animate-combo-pulse">
          <p className="text-sm text-primary font-bold">🔔 对手向你发起了重赛邀请！点击【再来一局】立即开战</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1 shadow-xs"
          onClick={onPlayAgain}
          disabled={isWaitingForRematch}
        >
          {isWaitingForRematch ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              等待对手确认...
            </span>
          ) : (
            "⚔️ 再来一局"
          )}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={copyBattleReport}
        >
          {copied ? "✅ 战报已复制！" : "📋 复制战报分享"}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="sm:w-32"
          onClick={onBackToMenu}
        >
          返回菜单
        </Button>
      </div>
    </div>
  )
}
